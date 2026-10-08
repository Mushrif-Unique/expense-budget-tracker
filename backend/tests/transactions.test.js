import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { validateJwtSecret } from '../utils/jwt.js';

dotenv.config({ quiet: true });
validateJwtSecret();
const dbName = `expense_tracker_tx_test_${randomUUID().replaceAll('-', '')}`;
let server;
let checks = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Transaction.init()]);
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method, path, expected, token, body) {
    const response = await fetch(base + path, { method, signal: AbortSignal.timeout(15000), headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    assert.equal(result.success, expected < 400);
    if (expected >= 400) assert.deepEqual(Object.keys(result).sort(), ['message', 'success']);
    checks++;
    return result.data;
  }
  const first = await request('POST', '/api/auth/register', 201, null, { name: 'First', email: 'first@example.com', password: 'TestPassword123!' });
  const second = await request('POST', '/api/auth/register', 201, null, { name: 'Second', email: 'second@example.com', password: 'TestPassword123!' });
  const root = '/api/transactions';
  const draft = { type: 'expense', amount: 125.5, category: ' Food ', description: ' Lunch (special) ', date: '2026-10-01' };
  assert.deepEqual((await request('GET', root, 200, first.token)).transactions, []);
  const { transaction } = await request('POST', root, 201, first.token, draft);
  assert.equal(transaction.user, first.user.id);
  assert.equal(transaction.category, 'Food');
  assert.equal(transaction.description, 'Lunch (special)');
  assert.equal(transaction.date, '2026-10-01T00:00:00.000Z');
  assert.ok(transaction.createdAt && transaction.updatedAt);
  const path = `${root}/${transaction._id}`;
  await request('POST', root, 201, first.token, { ...draft, type: 'income', category: 'Salary', date: '2026-10-03' });
  await request('POST', root, 201, second.token, draft);
  const listed = (await request('GET', root, 200, first.token)).transactions;
  assert.equal(listed.length, 2);
  assert.equal(listed[0].type, 'income');
  assert.ok(listed.every(item => item.user === first.user.id));
  assert.equal((await request('GET', root, 200, second.token)).transactions.length, 1);
  for (const [query, count] of [['?search=lunch', 2], ['?type=expense', 1], ['?category=food', 1], ['?search=special&type=expense&category=Food', 1], ['?search=Salary', 1], ['?search=absent', 0], ['?search=.*', 0], ['?category=Food.*', 0], ['?search=%28special%29', 2]]) {
    assert.equal((await request('GET', root + query, 200, first.token)).transactions.length, count);
  }
  await request('GET', path, 200, first.token);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    await request(method, path, 404, second.token, method === 'PUT' ? draft : undefined);
    await request(method, path, 401, null, method === 'PUT' ? draft : undefined);
    await request(method, `${root}/invalid`, 400, first.token, method === 'PUT' ? draft : undefined);
    await request(method, `${root}/${new mongoose.Types.ObjectId()}`, 404, first.token, method === 'PUT' ? draft : undefined);
  }
  assert.equal((await request('GET', path, 200, first.token)).transaction.amount, 125.5);
  await request('GET', root, 401);
  await request('POST', root, 401, null, draft);
  await request('GET', root, 401, 'invalid-token');
  const invalidBodies = [null, [], {}, { ...draft, type: 'transfer' }, { ...draft, amount: 0 }, { ...draft, amount: -1 }, { ...draft, amount: '10' }, { ...draft, amount: null }, { ...draft, category: '' }, { ...draft, category: { $ne: '' } }, { ...draft, category: 'x'.repeat(101) }, { ...draft, description: 1 }, { ...draft, description: 'x'.repeat(1001) }, { ...draft, date: '2026-02-30' }, { ...draft, date: '2025-02-29' }, { ...draft, date: 'nonsense' }, { ...draft, date: '2026-10-01T00:00:00Z' }, { ...draft, user: second.user.id }, { ...draft, $set: { user: second.user.id } }];
  for (const body of invalidBodies) {
    await request('POST', root, 400, first.token, body);
    await request('PUT', path, 400, first.token, body);
  }
  for (const query of ['?type=other', '?search=a&search=b', '?category=a&category=b', '?search[$ne]=x', '?user=other', '?search=' + 'x'.repeat(101)]) await request('GET', root + query, 400, first.token);
  const updated = (await request('PUT', path, 200, first.token, { type: 'income', amount: 200, category: 'Gift', date: '2024-02-29' })).transaction;
  assert.equal(updated.amount, 200);
  assert.equal(updated.description, '');
  assert.equal(updated.user, first.user.id);
  assert.equal((await request('GET', path, 200, first.token)).transaction.category, 'Gift');
  await assert.rejects(Transaction.create({ user: first.user.id, ...draft, amount: -1 }), { name: 'ValidationError' });
  await request('DELETE', path, 200, first.token);
  await request('GET', path, 404, first.token);
  await request('DELETE', path, 404, first.token);
  assert.equal((await request('GET', root, 200, first.token)).transactions.length, 1);
  assert.equal((await request('GET', root, 200, second.token)).transactions.length, 1);
  console.info(`PASS: ${checks} transaction API checks including CRUD, validation, search/filter combinations, and two-user isolation.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
