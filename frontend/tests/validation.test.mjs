import assert from 'node:assert/strict';
import { validateAuth } from '../src/utils/authValidation.js';
import { validateTransactionForm } from '../src/utils/transactions.js';

const auth = { name: 'Tester', email: 'test@example.com', password: 'ValidPass123!' };
assert.deepEqual(validateAuth(auth, true), {});
for (const patch of [{ name: '' }, { email: '' }, { email: 'invalid' }, { password: '' }, { password: 'short' }, { password: 'é'.repeat(37) }]) assert.ok(Object.keys(validateAuth({ ...auth, ...patch }, true)).length);
const transaction = { type: 'expense', amount: '10.5', category: 'Food', description: 'Lunch', date: '2024-02-29' };
assert.deepEqual(validateTransactionForm(transaction), {});
for (const patch of [{ type: 'other' }, { amount: '' }, { amount: '0' }, { amount: '-1' }, { amount: 'Infinity' }, { category: '' }, { category: 'x'.repeat(101) }, { description: 'x'.repeat(1001) }, { date: '' }, { date: '2025-02-29' }, { date: '2026-02-30' }]) assert.ok(Object.keys(validateTransactionForm({ ...transaction, ...patch })).length);
console.info('PASS: 19 frontend validation assertions for valid input, required fields, email/password rules, amounts, type, category, description, and dates.');
