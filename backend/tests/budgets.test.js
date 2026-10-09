import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { currentMonth } from '../utils/finance.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { validateJwtSecret } from '../utils/jwt.js';

dotenv.config({ quiet: true });
validateJwtSecret();
const dbName = `expense_tracker_budget_test_${randomUUID().replaceAll('-', '')}`;
let server;
let checks = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Budget.init(), Transaction.init()]);
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method, path, expected, token, body) {
    const response = await fetch(base + path, { method, signal: AbortSignal.timeout(15000), headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    assert.equal(result.success, expected < 400);
    if (expected >= 400) assert.deepEqual(Object.keys(result).sort(), ['message', 'success']);
    checks++;
    return result.data;
  }
  const register = email => request('POST', '/api/auth/register', 201, null, { name: 'Budget Tester', email, password: 'TestPassword123!' });
  const first = await register('first@example.com');
  const second = await register('second@example.com');
  const third = await register('third@example.com');
  const budgetPath = '/api/budgets/current';
  const dashboardPath = '/api/dashboard/summary';
  for (const [method, path] of [['GET', budgetPath], ['PUT', budgetPath], ['GET', dashboardPath]]) {
    await request(method, path, 401, null, method === 'PUT' ? { amount: 1 } : undefined);
    await request(method, path, 401, 'invalid', method === 'PUT' ? { amount: 1 } : undefined);
  }
  const empty = await request('GET', dashboardPath, 200, first.token);
  assert.equal(empty.totalIncome, 0); assert.equal(empty.totalExpenses, 0); assert.equal(empty.balance, 0);
  assert.deepEqual(empty.recentTransactions, []); assert.deepEqual(empty.expensesByCategory, []);
  assert.equal(empty.budget.isSet, false); assert.equal(empty.budget.amount, null); assert.equal(empty.budget.remaining, null); assert.equal(empty.budget.progressPercentage, null);
  for (const body of [null, [], {}, { amount: -1 }, { amount: '100' }, { amount: null }, { amount: true }, { amount: 1, user: second.user.id }, { amount: 1, month: 1 }, { amount: { $gt: 0 } }]) await request('PUT', budgetPath, 400, first.token, body);
  const zero = (await request('PUT', budgetPath, 200, first.token, { amount: 0 })).budget;
  assert.equal(zero.isSet, true); assert.equal(zero.progressPercentage, 0); assert.equal(zero.remaining, 0);
  const period = currentMonth();
  const date = period.start.toISOString().slice(0, 10);
  for (const [type, amount, category] of [['income', 80000, 'Salary'], ['expense', 10000, 'Food'], ['expense', 20000, 'Travel']]) {
    await request('POST', '/api/transactions', 201, first.token, { type, amount, category, date });
  }
  const beforeStart = new Date(period.start.getTime() - 86400000);
  await Transaction.create([
    { user: first.user.id, type: 'expense', amount: 7000, category: 'Food', date: beforeStart },
    { user: first.user.id, type: 'expense', amount: 3000, category: 'Travel', date: period.end },
    { user: second.user.id, type: 'expense', amount: 999999, category: 'Private', date: period.start },
  ]);
  const zeroWithSpending = (await request('GET', budgetPath, 200, first.token)).budget;
  assert.equal(zeroWithSpending.monthlyExpenses, 30000); assert.equal(zeroWithSpending.progressPercentage, 0); assert.equal(zeroWithSpending.overspent, 30000);
  const normal = (await request('PUT', budgetPath, 200, first.token, { amount: 50000 })).budget;
  assert.equal(normal.monthlyExpenses, 30000); assert.equal(normal.remaining, 20000); assert.equal(normal.progressPercentage, 60);
  const overspent = (await request('PUT', budgetPath, 200, first.token, { amount: 25000 })).budget;
  assert.equal(overspent.remaining, -5000); assert.equal(overspent.overspent, 5000); assert.equal(overspent.progressPercentage, 120);
  const dashboard = await request('GET', dashboardPath, 200, first.token);
  assert.equal(dashboard.totalIncome, 80000); assert.equal(dashboard.totalExpenses, 40000); assert.equal(dashboard.balance, 40000);
  assert.deepEqual(dashboard.budget, overspent);
  assert.deepEqual(dashboard.expensesByCategory, [{ category: 'Travel', total: 23000 }, { category: 'Food', total: 17000 }]);
  assert.equal(dashboard.recentTransactions.length, 5);
  assert.equal(dashboard.recentTransactions[0].date, period.end.toISOString());
  assert.ok(dashboard.recentTransactions.every(item => item.user === first.user.id));
  const extraBody = { type: 'expense', amount: 10, category: 'Refresh', date };
  const extra = await request('POST', '/api/transactions', 201, first.token, extraBody);
  const extraPath = `/api/transactions/${extra.transaction._id}`;
  const refreshed = await request('GET', dashboardPath, 200, first.token);
  assert.equal(refreshed.totalExpenses, 40010); assert.equal(refreshed.budget.monthlyExpenses, 30010);
  assert.equal(refreshed.recentTransactions.length, 5);
  await request('PUT', extraPath, 200, first.token, { ...extraBody, amount: 20 });
  const edited = await request('GET', dashboardPath, 200, first.token);
  assert.equal(edited.totalExpenses, 40020); assert.equal(edited.budget.monthlyExpenses, 30020);
  await request('DELETE', extraPath, 200, first.token);
  assert.equal((await request('GET', dashboardPath, 200, first.token)).totalExpenses, 40000);
  const other = await request('GET', dashboardPath, 200, second.token);
  assert.equal(other.totalExpenses, 999999); assert.equal(other.balance, -999999); assert.equal(other.budget.isSet, false);
  await request('PUT', budgetPath, 200, second.token, { amount: 100 });
  assert.equal((await request('GET', budgetPath, 200, first.token)).budget.amount, 25000);
  await Promise.all([100, 200, 300].map(amount => request('PUT', budgetPath, 200, third.token, { amount })));
  assert.equal(await Budget.countDocuments({ user: third.user.id, month: period.month, year: period.year }), 1);
  await assert.rejects(Budget.create({ user: first.user.id, month: period.month, year: period.year, amount: 1 }), error => error.code === 11000);
  await assert.rejects(Budget.create({ user: first.user.id, month: 13, year: 2026, amount: -1 }), { name: 'ValidationError' });
  await Transaction.create([
    { user: third.user.id, type: 'expense', amount: 0.1, category: 'Decimals', date: period.start },
    { user: third.user.id, type: 'expense', amount: 0.2, category: 'Decimals', date: period.start },
  ]);
  assert.equal((await request('GET', dashboardPath, 200, third.token)).totalExpenses, 0.3);
  const december = currentMonth(new Date('2026-12-31T23:59:59.999Z'));
  assert.equal(december.end.toISOString(), '2027-01-01T00:00:00.000Z');
  const leap = currentMonth(new Date('2024-02-29T12:00:00Z'));
  assert.equal(leap.end.toISOString(), '2024-03-01T00:00:00.000Z');
  const boundaryUser = new mongoose.Types.ObjectId();
  await Transaction.create([
    { user: boundaryUser, type: 'expense', amount: 5, category: 'Boundary', date: december.start },
    { user: boundaryUser, type: 'expense', amount: 10, category: 'Boundary', date: december.end },
  ]);
  assert.equal((await getBudgetSummary(boundaryUser, december)).monthlyExpenses, 5);
  console.info(`PASS: ${checks} budget/dashboard API checks plus unique index, decimal sums, month boundaries, zero budgets, overspending, and user isolation.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  } finally { await mongoose.disconnect(); }
}
