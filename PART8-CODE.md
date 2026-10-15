# Part 8 of 9 — Complete source
Complete new and updated files for pagination, filtered CSV export, validation checks, and responsive fixes. Each relative file path is followed by its full contents. The required features were verified before optional work. No runtime dependencies, environment values, or new API endpoints were added. Run and verification instructions are included in README below. PART8-AUDIT.md records coverage and limits. Part 9 final submission preparation is not included.

## backend/controllers/transactionController.js
````
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { validateTransaction, transactionFields, validateTransactionQuery, escapeSearch } from '../utils/transactionValidation.js';

const notFound = res => res.status(404).json({ success: false, message: 'Transaction not found' });
const badRequest = (res, message) => res.status(400).json({ success: false, message });

export async function listTransactions(req, res) {
  const error = validateTransactionQuery(req.query);
  if (error) return badRequest(res, error);
  const filter = { user: req.user.id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.category?.trim()) filter.category = { $regex: `^${escapeSearch(req.query.category.trim())}$`, $options: 'i' };
  if (req.query.search?.trim()) {
    const expression = { $regex: escapeSearch(req.query.search.trim()), $options: 'i' };
    filter.$or = [{ description: expression }, { category: expression }];
  }
  const limit = Number(req.query.limit ?? 10);
  const total = await Transaction.countDocuments(filter);
  const pages = Math.ceil(total / limit);
  const page = Math.min(Number(req.query.page ?? 1), Math.max(1, pages));
  const transactions = await Transaction.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
  return res.json({ success: true, message: 'Transactions retrieved', data: { transactions, pagination: { page, limit, total, pages } } });
}

export async function createTransaction(req, res) {
  const error = validateTransaction(req.body);
  if (error) return badRequest(res, error);
  const transaction = await Transaction.create({ ...transactionFields(req.body), user: req.user.id });
  return res.status(201).json({ success: true, message: 'Transaction created successfully', data: { transaction } });
}

export async function getTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction retrieved', data: { transaction } });
}

export async function updateTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const error = validateTransaction(req.body);
  if (error) return badRequest(res, error);
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: transactionFields(req.body) },
    { returnDocument: 'after', runValidators: true },
  );
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction updated successfully', data: { transaction } });
}

export async function deleteTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction deleted successfully', data: null });
}
````

## backend/utils/transactionValidation.js
````
const fields = ['type', 'amount', 'category', 'description', 'date'];

export function validateTransaction(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object.';
  if (Object.keys(body).some(key => !fields.includes(key))) return 'Only type, amount, category, description, and date may be supplied.';
  if (!['income', 'expense'].includes(body.type)) return 'Type must be income or expense.';
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) return 'Amount must be a positive finite number.';
  if (typeof body.category !== 'string' || !body.category.trim() || body.category.trim().length > 100) return 'Category is required and must be at most 100 characters.';
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.trim().length > 1000)) return 'Description must be text of at most 1000 characters.';
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return 'Date must be a valid calendar date in YYYY-MM-DD format.';
  const date = new Date(`${body.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) return 'Date must be a valid calendar date in YYYY-MM-DD format.';
  return null;
}

export function transactionFields(body) {
  return { type: body.type, amount: body.amount, category: body.category.trim(), description: body.description?.trim() || '', date: new Date(`${body.date}T00:00:00.000Z`) };
}

export function validateTransactionQuery(query) {
  if (Object.keys(query).some(key => !['search', 'type', 'category', 'page', 'limit'].includes(key))) return 'Supported query parameters are search, type, category, page, and limit.';
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string' || value.trim().length > 100) return `${key} must be a single text value of at most 100 characters.`;
  }
  for (const [key, maximum] of [['page', 1000000], ['limit', 100]]) {
    if (query[key] !== undefined && (!/^[1-9]\d*$/.test(query[key]) || !Number.isSafeInteger(Number(query[key])) || Number(query[key]) > maximum)) return key + ' must be a whole number from 1 to ' + maximum + '.';
  }
  if (query.type !== undefined && !['income', 'expense'].includes(query.type)) return 'Type must be income or expense.';
  return null;
}

export function escapeSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
````

## backend/tests/transactions.test.js
````
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
  await Transaction.insertMany(Array.from({ length: 25 }, (_, index) => ({ user: first.user.id, type: 'expense', amount: index + 1, category: 'Paging', description: index % 2 === 0 ? 'Match' : 'Other', date: '2026-10-01' })));
  const firstPage = await request('GET', root, 200, first.token);
  assert.equal(firstPage.transactions.length, 10);
  assert.deepEqual(firstPage.pagination, { page: 1, limit: 10, total: 26, pages: 3 });
  const secondPage = await request('GET', root + '?page=2&limit=10', 200, first.token);
  assert.equal(secondPage.transactions.length, 10);
  assert.ok(secondPage.transactions.every(item => !firstPage.transactions.some(first => first._id === item._id)));
  const filteredPage = await request('GET', root + '?search=Match&type=expense&category=Paging&page=2&limit=5', 200, first.token);
  assert.deepEqual(filteredPage.pagination, { page: 2, limit: 5, total: 13, pages: 3 });
  assert.ok(filteredPage.transactions.every(item => item.description === 'Match' && item.user === first.user.id));
  const lastPage = await request('GET', root + '?page=1000000', 200, first.token);
  assert.equal(lastPage.pagination.page, 3); assert.equal(lastPage.transactions.length, 6);
  const emptyPage = await request('GET', root + '?search=missing-value&page=2', 200, first.token);
  assert.deepEqual(emptyPage.pagination, { page: 1, limit: 10, total: 0, pages: 0 });
  const isolatedPage = await request('GET', root + '?page=2&limit=100', 200, second.token);
  assert.equal(isolatedPage.pagination.total, 1); assert.equal(isolatedPage.transactions.length, 1);
  for (const query of ['?page=0', '?page=-1', '?page=1.5', '?page=abc', '?page=', '?page=01', '?page=1000001', '?page=1&page=2', '?limit=0', '?limit=101', '?limit=-1', '?limit=1.5', '?limit=Infinity', '?limit=1&limit=2', '?page[$gt]=1']) await request('GET', root + query, 400, first.token);
  const deletionPage = await request('GET', root + '?category=Paging&limit=12&page=3', 200, first.token);
  assert.equal(deletionPage.transactions.length, 1);
  await request('DELETE', root + '/' + deletionPage.transactions[0]._id, 200, first.token);
  const recovered = await request('GET', root + '?category=Paging&limit=12&page=3', 200, first.token);
  assert.equal(recovered.pagination.page, 2); assert.equal(recovered.pagination.total, 24);
  console.info(`PASS: ${checks} transaction API checks including CRUD, validation, search/filter combinations, pagination, invalid query rejection, and two-user isolation.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
````

## frontend/src/pages/TransactionsPage.jsx
````
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import Modal from '../components/Modal.jsx';
import { formatAmount, formatDate } from '../utils/transactions.js';

import { collectFilteredTransactions, downloadTransactionsCsv } from '../utils/csv.js';

const emptyFilters = { search: '', type: '', category: '' };
export default function TransactionsPage() {
  const { request } = useAuth();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportController = useRef(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set('page', String(page)); query.set('limit', '10');
    request(`/transactions?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setTransactions(result.data.transactions); setPagination(result.data.pagination); setPage(result.data.pagination.page); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision, request, page]);
  async function save(body) {
    const editing = editor.transaction;
    await request(editing ? `/transactions/${editing._id}` : '/transactions', { method: editing ? 'PUT' : 'POST', body });
    setEditor(null); setNotice(editing ? 'Transaction updated.' : 'Transaction added.'); setRevision(value => value + 1);
  }
  async function remove() {
    setDeleteBusy(true); setDeleteError('');
    try {
      await request(`/transactions/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null); setNotice('Transaction deleted.'); setRevision(value => value + 1);
    } catch (failure) { setDeleteError(failure.message); }
    finally { setDeleteBusy(false); }
  }
  async function exportCsv() {
    if (exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true); setExportError('');
    try {
      const records = await collectFilteredTransactions(request, filters, controller.signal);
      if (!controller.signal.aborted) { downloadTransactionsCsv(records); setNotice(`Exported ${records.length} matching transactions.`); }
    } catch (failure) { if (!controller.signal.aborted) setExportError(failure.message); }
    finally { if (exportController.current === controller) { exportController.current = null; setExporting(false); } }
  }
  function resetExport() {
    exportController.current?.abort(); exportController.current = null; setExporting(false); setExportError('');
  }
  function apply(event) {
    event.preventDefault(); setNotice(''); setPage(1); resetExport();
    setFilters({ search: draft.search.trim(), type: draft.type, category: draft.category.trim() });
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Income & expenses</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Transactions</h1><p className="mt-3 text-slate-500">Keep track of the money coming in and going out.</p></div><button className="button-primary" onClick={() => { setNotice(''); setEditor({ transaction: null }); }}>Add transaction</button></div>
    {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice} Active filters still apply.</p>}
    <form onSubmit={apply} className="mt-8 grid items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 xl:grid-cols-[2fr_1fr_1fr_auto]">
      <div><label htmlFor="search" className="mb-2 block text-sm font-medium">Search</label><input id="search" className="form-input" placeholder="Description or category" maxLength={100} value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></div>
      <div><label htmlFor="filter-type" className="mb-2 block text-sm font-medium">Filter by type</label><select id="filter-type" className="form-input" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
      <div><label htmlFor="filter-category" className="mb-2 block text-sm font-medium">Filter by category</label><input id="filter-category" placeholder="All categories" className="form-input" maxLength={100} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></div>
      <div className="flex flex-wrap gap-2"><button className="button-primary">Apply filters</button><button type="button" className="button-secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setNotice(''); setPage(1); resetExport(); }}>Reset</button></div>
    </form>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Export includes every record matching the applied filters, across all pages.</p><button type="button" disabled={loading || Boolean(error) || pagination.total === 0 || exporting} className="button-secondary" onClick={exportCsv}>{exporting ? 'Exporting…' : 'Export CSV'}</button></div>
    {exportError && <p role="alert" className="mt-3 text-sm text-red-700">{exportError} Use Export CSV to retry.</p>}
    <section aria-label="Transaction history" aria-busy={loading} className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">Transaction history</h2><p className="mt-1 text-xs text-slate-500">Newest transaction dates first · Amounts in LKR</p></div>
      {loading ? <p role="status" className="p-8 text-slate-500">Loading transactions…</p> : error ? <div className="p-6"><p role="alert" className="text-red-700">{error}</p><button className="button-secondary mt-4" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : transactions.length === 0 ? <div className="p-8 text-center"><p className="font-medium">No transactions found.</p><p className="mt-2 text-sm text-slate-500">Add a transaction or adjust your filters.</p></div> : <ul className="divide-y divide-stone-100">{transactions.map(transaction => <li key={transaction._id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center" aria-label={`${transaction.category} transaction`}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>{transaction.type === 'income' ? 'Income' : 'Expense'}</span><span className="min-w-0 max-w-full break-words font-medium [overflow-wrap:anywhere]">{transaction.category}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{transaction.description || 'No description'}</p><time dateTime={transaction.date.slice(0, 10)} className="mt-2 block text-xs text-slate-500">{formatDate(transaction.date)}</time></div>
        <p className={`break-all font-semibold tabular-nums ${transaction.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}>{transaction.type === 'income' ? '+' : '−'}{formatAmount(transaction.amount)}</p>
        <div className="flex gap-2"><button className="button-secondary" onClick={() => setEditor({ transaction })}>Edit</button><button className="button-secondary text-red-700" onClick={() => { setDeleteError(''); setDeleting(transaction); }}>Delete</button></div>
      </li>)}</ul>}
      {!error && <nav aria-label="Transaction pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 p-5"><p aria-live="polite" className="text-sm text-slate-600">Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} transactions</p><div className="flex gap-2"><button className="button-secondary" disabled={loading || pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button><button className="button-secondary" disabled={loading || pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></nav>}
    </section>
    {editor && <TransactionForm transaction={editor.transaction} onSave={save} onClose={() => setEditor(null)} />}
    {deleting && <Modal title="Delete transaction?" busy={deleteBusy} onClose={() => setDeleting(null)}><p className="break-words text-slate-600">Delete the {deleting.category} transaction for {formatAmount(deleting.amount)}? This cannot be undone.</p>{deleteError && <p role="alert" className="mt-4 text-red-700">{deleteError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button className="button-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button className="button-primary bg-red-700 hover:bg-red-800" disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Deleting…' : 'Delete transaction'}</button></div></Modal>}
  </>;
}
````

## frontend/src/utils/csv.js
````
function csvCell(value, text = false) {
  let content = String(value ?? '');
  // Spreadsheet applications may execute formulas even in quoted cells.
  if (text && (/^\s*[=+@-]/u.test(content) || /^[\t\r\n]/.test(content))) content = "'" + content;
  return '"' + content.replaceAll('"', '""') + '"';
}

export function transactionsCsv(transactions) {
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount'].map(value => csvCell(value)).join(',');
  const rows = transactions.map(item => [csvCell(item.date.slice(0, 10)), csvCell(item.type), csvCell(item.category, true), csvCell(item.description, true), csvCell(item.amount)].join(','));
  return '\uFEFF' + [header, ...rows].join('\r\n') + '\r\n';
}

export async function collectFilteredTransactions(request, filters, signal) {
  const records = new Map();
  let pages = 1;
  let expectedTotal;
  for (let page = 1; page <= pages; page++) {
    if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set('page', String(page)); query.set('limit', '100');
    const { data } = await request(`/transactions?${query}`, { signal });
    if (expectedTotal === undefined) expectedTotal = data.pagination.total;
    if (data.pagination.page !== page || data.pagination.total !== expectedTotal) throw new Error('Transactions changed during export. Please retry.');
    pages = data.pagination.pages;
    for (const item of data.transactions) records.set(item._id, item);
  }
  if (records.size !== expectedTotal) throw new Error('Transactions changed during export. Please retry.');
  return [...records.values()];
}

export function downloadTransactionsCsv(transactions) {
  const url = URL.createObjectURL(new Blob([transactionsCsv(transactions)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
````

## frontend/src/pages/DashboardPage.jsx
````
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useApiData from '../hooks/useApiData.js';
import ApiState from '../components/ApiState.jsx';
import BudgetProgress from '../components/BudgetProgress.jsx';
import ExpenseChart from '../components/ExpenseChart.jsx';
import { formatAmount, formatDate } from '../utils/transactions.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useApiData('/dashboard/summary');
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0 max-w-full"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Your financial overview</p><h1 className="mt-3 break-words [overflow-wrap:anywhere] text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {user.name}.</h1><p className="mt-3 text-slate-500">A clearer view of your everyday finances.</p></div><button onClick={refresh} disabled={loading} className="button-secondary">Refresh overview</button></div>
    {loading || error ? <ApiState loading={loading} error={error} onRetry={refresh} /> : <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Total income', data.totalIncome], ['Total expenses', data.totalExpenses], ['Balance', data.balance], ['Monthly budget', data.budget.amount]].map(([label, amount]) => <section key={label} aria-label={label} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className={`mt-3 break-all text-2xl font-semibold tabular-nums ${label === 'Balance' && amount < 0 ? 'text-red-700' : 'text-slate-900'}`}>{amount === null ? 'Not set' : formatAmount(amount)}</p><p className="mt-2 text-xs text-slate-500">{label === 'Monthly budget' ? 'Current UTC month' : 'All recorded transactions'}</p></section>)}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><div><BudgetProgress budget={data.budget} /><Link to="/budget" className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4">Manage monthly budget</Link></div><ExpenseChart categories={data.expensesByCategory} /></div>
      <section aria-label="Recent transactions" className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-6"><h2 className="text-lg font-semibold">Recent transactions</h2><Link to="/transactions" className="text-sm font-semibold text-emerald-800 underline">View all transactions</Link></div>{data.recentTransactions.length === 0 ? <p className="p-8 text-center text-slate-500">No transactions yet. Add your first income or expense.</p> : <ul className="divide-y divide-stone-100">{data.recentTransactions.map(item => <li key={item._id} className="flex flex-wrap items-center justify-between gap-3 p-6"><div className="min-w-0"><p className="break-words font-medium [overflow-wrap:anywhere]">{item.category}</p><p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">{item.description || (item.type === 'income' ? 'Income' : 'Expense')}</p><time dateTime={item.date.slice(0, 10)} className="mt-1 block text-xs text-slate-500">{formatDate(item.date)}</time></div><span className={`break-all font-semibold tabular-nums ${item.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}>{item.type === 'income' ? '+' : '−'}{formatAmount(item.amount)}</span></li>)}</ul>}</section>
    </>}
  </>;
}
````

## frontend/src/pages/BudgetPage.jsx
````
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import useApiData from '../hooks/useApiData.js';
import ApiState from '../components/ApiState.jsx';
import BudgetProgress, { budgetMonth } from '../components/BudgetProgress.jsx';

export default function BudgetPage() {
  const { request } = useAuth();
  const { data, loading, error, refresh } = useApiData('/budgets/current');
  const [budget, setBudget] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (data) { setBudget(data.budget); setAmount(data.budget.isSet ? String(data.budget.amount) : ''); } }, [data]);
  async function save(event) {
    event.preventDefault(); setNotice(''); setSaveError('');
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setSaveError('Enter a budget amount of zero or more.'); document.getElementById('budget-amount')?.focus(); return; }
    setBusy(true);
    try {
      const result = await request('/budgets/current', { method: 'PUT', body: { amount: Number(amount) } });
      setBudget(result.data.budget); setAmount(String(result.data.budget.amount)); setNotice('Monthly budget saved.');
    } catch (failure) { setSaveError(failure.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Plan your month</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Monthly budget</h1><p className="mt-3 text-slate-500">Set a spending limit that works for you.</p></div><button disabled={loading || busy} className="button-secondary" onClick={() => { setNotice(''); setSaveError(''); refresh(); }}>Refresh budget</button></div>
    {loading || error || !budget ? <ApiState loading={loading || (!error && !budget)} error={error} onRetry={refresh} /> : <div className="mt-8 grid items-start gap-6 xl:grid-cols-2"><BudgetProgress budget={budget} /><section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><h2 className="text-lg font-semibold">{budget.isSet ? 'Update your budget' : 'Set your budget'}</h2><p className="mt-2 text-sm text-slate-500">{budgetMonth(budget)} · LKR</p><form onSubmit={save} noValidate aria-busy={busy} className="mt-6"><label htmlFor="budget-amount" className="mb-2 block text-sm font-medium">Budget amount (LKR)</label><input id="budget-amount" type="number" step="any" min="0" inputMode="decimal" required disabled={busy} value={amount} onChange={event => setAmount(event.target.value)} className="form-input" aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'budget-error' : 'budget-help'} /><p id="budget-help" className="mt-2 text-xs text-slate-500">Zero is allowed. Your budget applies to this month only.</p>{saveError && <p id="budget-error" role="alert" className="mt-4 text-sm text-red-700">{saveError}</p>}{notice && <p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}<button disabled={busy} className="button-primary mt-6 w-full">{busy ? 'Saving…' : 'Save budget'}</button></form></section></div>}
  </>;
}
````

## frontend/src/components/ExpenseChart.jsx
````
import { formatAmount } from '../utils/transactions.js';

export default function ExpenseChart({ categories }) {
  const maximum = categories.reduce((maximum, item) => Math.max(maximum, item.total), 0);
  return <figure aria-label="Expenses by category" className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <figcaption className="text-lg font-semibold">Expenses by category</figcaption><p className="mt-1 text-xs text-slate-500">All recorded expenses · LKR</p>
    {maximum === 0 ? <p className="py-10 text-center text-sm text-slate-500">No expense data yet. Add an expense to see your chart.</p> : <ul className="mt-6 space-y-5">{categories.map(item => <li key={item.category}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{item.category}</span><span className="break-all tabular-nums text-slate-600">{formatAmount(item.total)}</span></div><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(0, Math.min(100, item.total / maximum * 100))}%` }} /></div></li>)}</ul>}
  </figure>;
}
````

## frontend/src/index.css
````
@import "tailwindcss";

@layer base {
  body { margin: 0; min-width: 320px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  button:not(:disabled), a { cursor: pointer; }
  a:focus-visible, button:focus-visible { outline: 2px solid #047857; outline-offset: 4px; }
}
@layer components {
  .form-input { @apply w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:bg-stone-100; }
  .form-input[aria-invalid="true"] { @apply border-red-500; }
  .button-primary { @apply rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60; }
  .button-secondary { @apply rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50; }
}
````

## frontend/package.json
````
{
  "name": "expense-tracker-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node node_modules/vite/bin/vite.js",
    "build": "node node_modules/vite/bin/vite.js build",
    "preview": "node node_modules/vite/bin/vite.js preview",
    "test": "node tests/validation.test.mjs && node tests/csv.test.mjs"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router-dom": "^7.18.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^5.2.0",
    "tailwindcss": "^4.3.3",
    "vite": "^7.3.6"
  }
}
````

## frontend/tests/validation.test.mjs
````
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
````

## frontend/tests/csv.test.mjs
````
import assert from 'node:assert/strict';
import { transactionsCsv, collectFilteredTransactions } from '../src/utils/csv.js';
const row = { _id: '1', date: '2026-10-14T00:00:00.000Z', type: 'expense', category: 'Food, drinks', description: 'A "quote"\nand newline', amount: 12.5, user: 'private', password: 'secret' };
assert.equal(transactionsCsv([row]), '\uFEFF"Date","Type","Category","Description","Amount"\r\n"2026-10-14","expense","Food, drinks","A ""quote""\nand newline","12.5"\r\n');
for (const text of ['=1+1', '+SUM(A1)', '-2+1', '@SUM(A1)', '  =1+1', '\ttext', '\ntext']) assert.ok(transactionsCsv([{ ...row, description: text }]).includes('"\'' + text + '"'));
assert.ok(!transactionsCsv([row]).includes('private')); assert.ok(!transactionsCsv([row]).includes('secret'));
assert.equal(transactionsCsv([]).split('\r\n').length, 2);
const items = Array.from({ length: 205 }, (_, index) => ({ ...row, _id: String(index) }));
const requested = [];
const collected = await collectFilteredTransactions(async path => {
  const params = new URL('http://test' + path).searchParams;
  assert.equal(params.get('category'), 'Food & Drink'); assert.equal(params.get('search'), 'Lunch'); assert.equal(params.get('limit'), '100');
  const page = Number(params.get('page')); requested.push(page);
  return { data: { transactions: items.slice((page - 1) * 100, page * 100), pagination: { page, pages: 3, total: 205 } } };
}, { category: 'Food & Drink', search: 'Lunch', type: 'expense' }, new AbortController().signal);
assert.deepEqual(requested, [1, 2, 3]); assert.equal(collected.length, 205);
await assert.rejects(collectFilteredTransactions(async () => { throw new Error('Offline'); }, {}, new AbortController().signal), /Offline/);
let call = 0;
await assert.rejects(collectFilteredTransactions(async () => ({ data: { transactions: [row], pagination: { page: ++call, pages: 2, total: call === 1 ? 2 : 3 } } }), {}, new AbortController().signal), /changed during export/);
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(collectFilteredTransactions(async () => assert.fail('No request after abort'), {}, cancelled.signal), { name: 'AbortError' });
console.info('PASS: CSV quoting, Unicode BOM, formula neutralization, safe fields, empty CSV, 205-record export, filters, request failure, concurrent-change detection, and cancellation.');
````

## frontend/tests/pagination.browser.mjs
````
import Transaction from '../../backend/models/Transaction.js';
import { readFile } from 'node:fs/promises';
import { transactionsCsv } from '../src/utils/csv.js';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../../backend/app.js';
import User from '../../backend/models/User.js';
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mongoose = requireBackend('mongoose');
const dotenv = requireBackend('dotenv');
dotenv.config({ path: fileURLToPath(new URL('../../backend/.env', import.meta.url)), quiet: true });
const database = `expense_ui_test_${randomUUID().replaceAll('-', '')}`;
const origin = 'http://localhost:5181';
process.env.CLIENT_URL = origin;
let api, vite, browser;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: database, serverSelectionTimeoutMS: 5000 });
  await User.init();
  api = createApp().listen(0, '127.0.0.1'); await once(api, 'listening');
  const apiUrl = `http://127.0.0.1:${api.address().port}/api`;
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5181'], { cwd: new URL('../', import.meta.url), env: { ...process.env, VITE_API_URL: apiUrl }, stdio: 'pipe' });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (vite.exitCode !== null) throw new Error('Test Vite server exited');
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'Vite startup');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  async function register(email, name) {
    const result = await fetch(apiUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password: 'BrowserTest123!' }) });
    assert.equal(result.status, 201); return (await result.json()).data;
  }
  const owner = await register('paging@example.com', 'N'.repeat(100));
  const other = await register('private@example.com', 'Private User');
  await Transaction.insertMany(Array.from({ length: 101 }, (_, index) => ({ user: owner.user.id, type: 'expense', amount: index + 0.5, category: index === 100 ? 'C'.repeat(100) : 'Food', description: index === 100 ? 'L'.repeat(1000) : index === 99 ? '=SUM(1,2)' : index === 98 ? 'Quoted "text", with\nnewline' : `Expense ${index}`, date: '2026-10-14' })));
  await Transaction.create({ user: other.user.id, type: 'expense', amount: 100, category: 'PRIVATE-DATA', description: 'Must not export', date: '2026-10-14' });
  await page.goto(origin + '/transactions');
  await page.getByLabel('Email address').fill('paging@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const history = page.getByRole('region', { name: 'Transaction history' });
  await page.getByText('Page 1 of 11 · 101 transactions', { exact: true }).waitFor();
  await history.getByRole('listitem').nth(9).waitFor();
  assert.equal(await history.getByRole('listitem').count(), 10);
  assert.equal(await page.getByRole('button', { name: 'Previous', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 of 11 · 101 transactions', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByText('Page 1 of 11 · 101 transactions', { exact: true }).waitFor();
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Long transaction text at ${width}`);
    assert.ok(await history.getByText('C'.repeat(100), { exact: true }).evaluate(el => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 1), 'Category stays within its text column');
    await page.screenshot({ path: fileURLToPath(new URL(`../.local/part8-transactions-${width}.png`, import.meta.url)), fullPage: true });
    await history.getByRole('listitem').first().getByRole('button', { name: 'Edit', exact: true }).click();
    assert.ok(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth), `Edit dialog at ${width}`);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  await page.route('**/api/transactions?*', route => new URL(route.request().url()).searchParams.get('limit') === '100' ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Use Export CSV to retry.' }).waitFor();
  await page.unroute('**/api/transactions?*');
  async function downloadExpected(filter = {}) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV', exact: true }).click()]);
    const content = await readFile(await download.path(), 'utf8');
    const rows = await Transaction.find({ user: owner.user.id, ...filter }).sort({ date: -1, _id: -1 }).lean();
    assert.equal(content, transactionsCsv(JSON.parse(JSON.stringify(rows))));
    assert.ok(!content.includes('PRIVATE-DATA')); assert.ok(!content.includes('paging@example.com')); assert.ok(!content.includes('password'));
    return content;
  }
  const allCsv = await downloadExpected();
  assert.ok(allCsv.includes("'=SUM(1,2)"));
  await page.getByLabel('Filter by category').fill('Food');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByText('Page 1 of 10 · 100 transactions', { exact: true }).waitFor();
  await downloadExpected({ category: 'Food' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 of 10 · 100 transactions', { exact: true }).waitFor();
  await page.getByLabel('Search', { exact: true }).fill('not-matching');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByText('No transactions found.', { exact: true }).waitFor();
  await page.getByText('Page 1 of 1 · 0 transactions', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByText('Page 1 of 11 · 101 transactions', { exact: true }).waitFor();
  for (let index = 2; index <= 11; index++) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText(`Page ${index} of 11 · 101 transactions`, { exact: true }).waitFor();
  }
  assert.equal(await history.getByRole('listitem').count(), 1);
  await history.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete transaction', exact: true }).click();
  await page.getByText('Page 10 of 10 · 100 transactions', { exact: true }).waitFor();
  await history.getByRole('listitem').nth(9).waitFor();
  assert.equal(await history.getByRole('listitem').count(), 10);
  for (const path of ['/dashboard', '/budget']) {
    await page.goto(origin + path);
    await page.getByRole('button', { name: path === '/dashboard' ? 'Refresh overview' : 'Refresh budget', exact: true }).waitFor();
    if (path === '/dashboard') await page.getByRole('figure', { name: 'Expenses by category' }).waitFor();
    else await page.getByLabel('Budget amount (LKR)').waitFor();
    for (const width of [320, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} long text at ${width}: ${await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => el.tagName + '.' + el.className).join('; '))}`);
    }
  }
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  for (const path of ['/login', '/register']) {
    await page.goto(origin + path);
    await page.getByLabel('Email address').waitFor();
    for (const width of [320, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} at ${width}`);
    }
  }
  assert.deepEqual(pageErrors, []);
  console.info('PASS: 101-record pagination, all-page/filtered CSV downloads, quoting/formula safety, export retry, empty results, filter reset, last-page deletion recovery, ownership, and five-page responsive audit at 320/768/1440/1920px including long text.');
} finally {
  if (browser) await browser.close();
  if (vite && vite.exitCode === null) { const exit = once(vite, 'exit'); vite.kill(); await exit; }
  if (api) await new Promise(resolve => api.close(resolve));
  try { if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase(); }
  finally { await mongoose.disconnect(); }
}
````

## PART8-AUDIT.md
````
# Part 8 — Validation, responsiveness, and optional features audit

The existing 154 backend checks and three browser suites passed before pagination/export implementation. The completed scope retains the required stack and adds no runtime dependencies. Part 9's final submission review remains separate.

| Area | Evidence |
| --- | --- |
| Registration/login | Required fields, email/password validation, duplicate email, failed login, saved sessions, expiry, logout, and cross-tab logout covered by API/browser tests. |
| Transaction validation | Required/invalid amount, category, date, type, descriptions, malformed IDs, and extra ownership fields covered by backend tests; 19 frontend validation assertions cover form rules. |
| Budgets | Blank/negative/zero budget handling, persistence, spending percentages, overspending, and server errors covered by backend/browser suites. |
| Authorization | Tests use separate users and verify isolated reads, edits, deletes, totals, budgets, pagination counts, and CSV downloads. |
| Loading/error states | API unavailable, expired sessions, invalid forms, empty results, failed saves/deletes, failed export, and recovery/retry exercised in browser tests. |
| Responsive layouts | Login, registration, transactions, dashboard, and budget checked at 320, 768, 1440, and 1920px. Transaction dialogs and long unbroken text included. |
| Accessibility | Existing label associations, alerts, status announcements, keyboard dialog dismissal/focus containment, and navigation retained. Budget validation now focuses its field; disabled secondary controls have visible feedback. This is not a formal WCAG certification. |
| Pagination | Defaults/bounds, malformed/repeated query values, combined filters, deterministic ordering, empty results, second-user exclusion, and last-page deletion tested. |
| CSV | Full 101-record browser download and filtered content compared with expected records. Unit test gathers 205 records across three requests; checks quoting, line breaks, Unicode BOM, formula-leading text, allowed columns, failures, cancellation, and detected concurrent changes. |

## Fixes made

- Long account names could force the dashboard heading beyond a 320px viewport. Restricted its flex child width and enabled wrapping anywhere; included regression coverage.
- Kept long transaction category labels within their text column instead of extending toward amount/action controls.
- Added disabled-control styling and focused the invalid budget amount for keyboard users.
- Replaced a spread-based chart maximum with a reduction to avoid argument-count limits on large category lists.

## Boundaries

- UI page size is 10. API page size is capped at 100. Empty API results have pages=0, while the UI labels the empty state Page 1 of 1.
- CSV uses the applied filters, contains only transaction fields, and neutralizes formula-like text. Pagination/export use existing authenticated APIs.
- Multi-request exports are not transactional snapshots; count-preserving concurrent edits can affect results. Browser memory limits still apply to very large personal datasets.
- Currency remains LKR; monthly budget boundaries remain UTC. No deployment, Git commit/push, demo video, or submission document was performed in Part 8.

## Commands

Run from the project root:

```powershell
npm.cmd test --prefix frontend
npm.cmd test --prefix backend
npm.cmd run build --prefix frontend
```

Optional browser suites require the existing Playwright/Edge setup described in README. Temporary test databases are removed after each suite; application data is not used.
````

## README.md
````
# Expense & Budget Tracker

## Project Overview

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–8: Core Application, Validation/Responsive Audit, Pagination, and CSV Export**.

## Features

Implemented: responsive login/registration pages, persistent authentication, protected application layout and navigation, logout, Express API, MongoDB connection configuration, backend authentication, user-owned transaction APIs with search and filters, monthly budgets, dashboard calculations, and a live transaction UI with forms, search, filters, and delete confirmation.

Implemented in Part 8: validation/responsive audit, transaction pagination, and filtered CSV export. Remaining in Part 9: final integration/security review and submission preparation.

## Technologies Used

JavaScript, React, Vite, Tailwind CSS, React Router, Node.js, Express, MongoDB, and Mongoose. bcryptjs hashes passwords and jsonwebtoken signs and verifies backend authentication tokens. Frontend authentication is implemented in Part 5.

## Project Structure

```text
frontend/
  public/
  src/
    components/ context/ layouts/ pages/ services/ utils/
    App.jsx main.jsx index.css
  .env.example index.html package.json vite.config.js
backend/
  config/ controllers/ middleware/ models/ routes/ services/ utils/
  .env.example app.js server.js package.json
.gitignore
README.md
```

Empty folders contain `.gitkeep` files so Git preserves the intended structure. Part 2 adds the User model and Part 3 adds the Transaction model. Part 4 adds the Budget model and shared budget calculation service.

## Installation

Prerequisites: Node.js 22.12+ (Node 24 LTS recommended), npm, and a running local MongoDB server or a MongoDB Atlas connection. Run the following PowerShell commands from the project root after cloning. Copy environment files only on first setup; do not overwrite existing configured files.

```powershell
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Environment Variables

`backend/.env`:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/expense_budget_tracker
JWT_SECRET=
CLIENT_URL=http://localhost:5173
```

`JWT_SECRET` must contain a private random value of at least 32 characters. On a fresh setup, generate a private value using `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and save it only in `backend/.env`. Never commit it. Replace MONGODB_URI if using Atlas; do not put credentials in `.env.example`.

`frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Vite exposes `VITE_` values publicly; never put secrets there. Restart the relevant server after changing environment files. CLIENT_URL must match the frontend origin, without a trailing slash.

## Running the Backend

In a terminal at the project root:

```powershell
cd backend
npm.cmd run dev
```

Expected startup: `MongoDB connected.` followed by the API listening on port 5000. The HTTP server starts only after a successful database connection. `npm.cmd start` runs without watch mode.

## Running the Frontend

In a separate terminal at the project root:

```powershell
cd frontend
npm.cmd run dev
```

Open http://localhost:5173. Guests are redirected to the sign-in page. Register or sign in to open the protected workspace. Transactions, dashboard, budget progress, and the expense chart use live API data. No financial values are fabricated.

Tailwind CSS uses `@tailwindcss/vite` in `vite.config.js` and `@import "tailwindcss"` in `src/index.css`; no separate Tailwind configuration file is required for this setup.

## API Overview

`GET /api/health` returns HTTP 200:

```json
{
  "success": true,
  "message": "Expense & Budget Tracker API is running"
}
```

Unknown routes return HTTP 404 and a consistent JSON error. Invalid JSON returns 400. Oversized request bodies return 413. The health route is a basic liveness endpoint; it is not a continuous database-readiness monitor.

## Verification

With both servers running, use a third terminal:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
curl.exe -i http://localhost:5000/api/missing
npm.cmd run build --prefix frontend
node --check backend/server.js
node --check backend/app.js
node --check backend/config/db.js
```

Confirm the startup log reports MongoDB connected. Check registration, login, refresh persistence, mobile navigation, logout, and protected-route redirects. Open `/missing` and use Return home. Test at 320px, tablet, and desktop widths. During an API outage, restoring a saved session shows retry and sign-in options.

Common errors:

- MongoDB connection failed: confirm the MongoDB service is running and MONGODB_URI is correct. For Atlas, check network access and credentials.
- Port already in use: stop the conflicting process or change PORT and VITE_API_URL together. If changing the frontend port, also update CLIENT_URL and Vite's server port.
- API unreachable/CORS: check both environment files, start both servers, and use the exact frontend origin configured in CLIENT_URL.
- Unsupported Node engine: use Node.js 22.12+.
- PowerShell blocks npm.ps1: use the documented `npm.cmd` commands.
- Git reports dubious ownership after sandbox initialization: use `git -c safe.directory="D:/Gamage Projects/expense-budget-tracker" status` (and the same `-c` option for add/commit) for this known workspace, without changing global Git settings.

## Git Workflow

If the folder has not been initialized, run `git init` once. Review files before committing:

```powershell
git status --short
git add .
git commit -m "chore: initialize full-stack expense tracker project"
```

`.env`, dependencies, logs, and build output are ignored; example environment files and lockfiles should be committed. Continue one part at a time and create a meaningful commit after each part.

## Screenshots

Final screenshots will be captured after the corresponding pages are implemented: login/register, dashboard, transactions, and budget.

## Author

The assignment author's name will be supplied during submission preparation.

## Development Progress

Parts 1–8 implemented (8/9). Next: Part 9 final integration/security review, documentation, demo script, and submission preparation. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

## Backend Authentication (Part 2)

- `POST /api/auth/register`: JSON `{ "name": "Demo User", "email": "demo@example.com", "password": "ExamplePass123!" }`; returns 201 with `data.user` and `data.token`.
- `POST /api/auth/login`: JSON email and password; returns 200 with the same safe user/token shape. Invalid credentials return 401.
- `GET /api/auth/me`: send `Authorization: Bearer <token>`; returns 200 with `data.user`, or 401 for missing, invalid, expired tokens or deleted users.

Emails are trimmed and lowercased, with a unique MongoDB index. Names are 1–100 trimmed characters; passwords require at least 8 characters and at most 72 UTF-8 bytes (bcrypt's input limit). Passwords are hashed with bcrypt cost 12 and omitted from responses. JWTs use HS256 and expire after one day. Registration rejects duplicate emails with 409, including concurrent requests. Validation failures return 400. Unexpected failures return a generic 500 response.

Run the repeatable integration suite from the project root:

```powershell
npm.cmd test --prefix backend
```

Tests use the configured MongoDB server but a unique `expense_tracker_auth_test_...` database, then remove only that database. The MongoDB account must permit creation and deletion of the test database. Application data is not used. Tests cover registration/login, validation, duplicate races, password hashing, safe responses, token failures, deleted users, health, and error handling.

Manual PowerShell verification (start the backend first; use a fresh email for registration):

```powershell
$body = @{ name = 'Demo User'; email = 'demo@example.com'; password = 'ExamplePass123!' } | ConvertTo-Json
$registration = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/register -ContentType 'application/json' -Body $body
$credentials = @{ email = 'demo@example.com'; password = 'ExamplePass123!' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/auth/login -ContentType 'application/json' -Body $credentials
Invoke-RestMethod -Uri http://localhost:5000/api/auth/me -Headers @{ Authorization = "Bearer $($login.data.token)" }
curl.exe -i http://localhost:5000/api/auth/me
```

Expected: registration succeeds, login returns a token, authenticated lookup returns only safe user fields, and the final unauthenticated call returns 401. Keep tokens private. A repeated registration email returns 409. If startup fails, check that JWT_SECRET is set, MongoDB is reachable, and the user email index can be created. Login and registration pages are now available.

## Transaction APIs (Part 3)

Every endpoint requires `Authorization: Bearer <token>`. The authenticated user owns every operation. A transaction belonging to another user returns the same 404 response as a missing transaction.

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/transactions | 200, `data.transactions` |
| POST | /api/transactions | 201, `data.transaction` |
| GET | /api/transactions/:id | 200, `data.transaction` |
| PUT | /api/transactions/:id | 200, `data.transaction` |
| DELETE | /api/transactions/:id | 200, `data: null` |

Create and update accept the following complete payload (description may be omitted):

```json
{
  "type": "expense",
  "amount": 125.50,
  "category": "Food",
  "description": "Lunch",
  "date": "2026-10-07"
}
```

Type must be `income` or `expense`. Amount must be a finite JSON number greater than zero, not a quoted number. Category is required and limited to 100 trimmed characters. Description is optional and limited to 1000 trimmed characters. Dates must be real calendar dates in `YYYY-MM-DD` format; they are stored as UTC midnight. When displaying dates later, preserve the calendar date rather than shifting it into a local timezone. PUT replaces all editable fields; omitted description becomes empty text. User IDs, timestamps, database operators, and other extra fields are rejected.

Transactions are ordered by date descending, then ID descending. Search is a case-insensitive literal substring match on description or category. Category filtering is a case-insensitive exact match. Filters can be combined:

```text
/api/transactions?search=lunch&type=expense&category=Food
```

Blank search/category values are ignored. Invalid or repeated filter values return 400. Pagination accepts page and limit; unknown query keys are rejected. See Part 8 below for defaults and response metadata. Empty results return an empty array. Malformed IDs return 400; missing/other-user IDs return 404. Unauthorized calls return 401. These APIs are intended for the Part 6 frontend transaction page.

### Part 3 verification

From the project root:

```powershell
npm.cmd test --prefix backend
npm.cmd run test:transactions --prefix backend
npm.cmd run build --prefix frontend
```

The full test command runs authentication and transaction suites; the second command runs only transaction checks when needed. Each suite uses a uniquely named temporary database and removes only its own database afterward. Tests cover two-user isolation, all CRUD operations, combined filters, literal regex characters, validation, malformed IDs, unknown IDs, and attempts to supply ownership fields.

For manual checks, start the backend with `npm.cmd run dev --prefix backend`, then log in using the authentication instructions above. With `$login` populated, run:

```powershell
$headers = @{ Authorization = "Bearer $($login.data.token)" }
$body = @{ type = 'expense'; amount = 125.50; category = 'Food'; description = 'Lunch'; date = '2026-10-07' } | ConvertTo-Json
$created = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/transactions -Headers $headers -ContentType 'application/json' -Body $body
$transactionId = $created.data.transaction._id
Invoke-RestMethod -Uri "http://localhost:5000/api/transactions/$transactionId" -Headers $headers
Invoke-RestMethod -Uri 'http://localhost:5000/api/transactions?search=lunch&type=expense&category=Food' -Headers $headers
$updated = @{ type = 'expense'; amount = 150; category = 'Food'; description = 'Updated lunch'; date = '2026-10-07' } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:5000/api/transactions/$transactionId" -Headers $headers -ContentType 'application/json' -Body $updated
# Deletes only the demonstration transaction created above.
Invoke-RestMethod -Method Delete -Uri "http://localhost:5000/api/transactions/$transactionId" -Headers $headers
```

Repeat lookup/update/delete with a second account's token before deleting to confirm 404 and that the first user's record remains unchanged. Do not put tokens or database credentials in Git. No additional dependency installation or environment variables are needed for Part 3.

## Budgets and Dashboard (Part 4)

All three endpoints require the user's Bearer token:

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/budgets/current | 200, `data.budget` |
| PUT | /api/budgets/current | 200, `data.budget` (create or update) |
| GET | /api/dashboard/summary | 200, dashboard fields in `data` |

PUT accepts only `{ "amount": 50000 }`. Amount must be a finite JSON number greater than or equal to zero. The server determines the user, month, and year; supplying these in the body is rejected with 400. A unique user/month/year database index prevents duplicates, including concurrent first saves. Startup waits for the budget index to be ready. No new packages or environment values are required.

The current month uses **UTC calendar boundaries**, from the first day inclusive to the next month's first day exclusive, matching the UTC calendar dates stored by the transaction API. This does not depend on the computer's timezone. Only expenses dated in this month count toward the budget; income and other months are excluded.

Example budget response fields:

```json
{
  "isSet": true,
  "month": 10,
  "year": 2026,
  "amount": 50000,
  "monthlyExpenses": 30000,
  "remaining": 20000,
  "overspent": 0,
  "progressPercentage": 60
}
```

No saved budget returns `isSet: false`, null amount/remaining/progress, zero overspent, and the actual monthly expenses. A saved zero budget returns `isSet: true`, amount 0 and progress 0; spending is still reported as overspent and negative remaining. For positive budgets, progress may exceed 100%; the future UI should cap only the visual bar. Example: 30000 spent against 25000 returns remaining -5000, overspent 5000, and progress 120.

Dashboard fields are `totalIncome`, `totalExpenses`, `balance`, `recentTransactions`, `expensesByCategory`, and `budget`. Totals and category sums cover **all recorded transaction dates**, including future-dated records; only the nested budget is current-month-specific. Balance is income minus expenses. Recent transactions contain at most five records sorted by transaction date descending, with ID descending for ties. Category entries contain `category` and `total`, use the stored category labels, and sort by total descending. Empty accounts return zero totals and empty arrays. All reads and aggregations are scoped to the authenticated user.

MongoDB sums amounts as decimals before returning totals rounded to two decimal places. Remaining, balance, and budget percentage are also rounded to two decimals. Numeric amounts remain JSON numbers, consistent with Part 3.

### Part 4 verification

From the project root, with MongoDB running:

```powershell
npm.cmd test --prefix backend
# To run only the budget/dashboard suite:
npm.cmd run test:budgets --prefix backend
npm.cmd run build --prefix frontend
```

Tests use isolated, uniquely named temporary databases and delete only their own test databases. They cover empty accounts, invalid budgets, no-token/invalid-token requests, create/update, zero budgets, overspending, concurrent saves, uniqueness, monthly boundaries, December/January rollover, leap-year boundaries, decimal sums, dashboard totals, category totals, recent-date order, and user isolation.

Manual API checks after logging in as described above:

```powershell
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Invoke-RestMethod -Uri http://localhost:5000/api/budgets/current -Headers $headers
$body = @{ amount = 50000 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:5000/api/budgets/current -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod -Uri http://localhost:5000/api/dashboard/summary -Headers $headers
```

Create current-month transactions using Part 3's examples and verify the totals manually. Repeating PUT updates the same monthly record. Test with a second account to confirm its totals/budget are separate. If startup reports an index error, check database permissions and any duplicate existing user/month/year budget documents; do not delete application data blindly. Budget/dashboard pages are implemented in Part 7.

## Frontend Authentication and Layout (Part 5)

Routes: `/login`, `/register`, `/dashboard`, `/transactions`, and `/budget`. `/` redirects according to authentication state. Guests visiting a protected route are returned to that route after successful authentication. Unknown routes retain a page-not-found screen. The authenticated navigation includes desktop links, a collapsible mobile menu, and logout. The transaction, overview, and budget pages are implemented. The overview displays real user-specific totals, recent transactions, monthly spending, and expense categories.

AuthContext handles login/registration, persists the JWT in localStorage, and verifies saved sessions with `/api/auth/me` before showing private pages. User data is fetched from the server rather than trusted from storage. Expired/invalid sessions are cleared; logout clears local state/storage and synchronizes across tabs. API outages retain the saved token and offer retry or sign-in. The authenticated request helper clears a session on 401 and does not log tokens. Bearer-token logout is client-side; it does not revoke an already issued token on the server. Tokens expire after one day. LocalStorage is readable by same-origin scripts, so avoid untrusted scripts and HTML injection.

Forms validate required fields, email format, name length, registration password minimum length, and bcrypt's 72-byte password limit. Passwords are masked. Inputs use autocomplete, associated labels, inline field errors, and disabled loading states. Server errors appear in an alert. Requests time out after 15 seconds. Backend validation remains authoritative.

### Part 5 manual verification

Run from the project root in separate terminals:

```powershell
npm.cmd run dev --prefix backend
```

```powershell
npm.cmd run dev --prefix frontend
```

1. Open `/transactions` while logged out; expect login.
2. Submit an empty form, invalid email, and short registration password; expect field errors.
3. Register a fresh account; expect the requested protected page and signed-in navigation.
4. Refresh; expect session restoration and the same account.
5. Log out, then log in with wrong and correct credentials; confirm error/success.
6. Try registration with an existing email; confirm the server error.
7. Open a second tab and log out in the first; both should return to login.
8. Stop the backend and refresh a logged-in page; retry must be available. Restart and retry.
9. Check the menu, forms, long text, keyboard focus, and page widths at 320px, 768px, and desktop.
10. Confirm `/missing` shows the not-found page, and logout prevents access to protected pages.

Run `npm.cmd run build --prefix frontend` for the production build. No new application dependencies or environment values are required.

### Optional repeatable browser suite

`frontend/tests/auth.browser.mjs` runs against real backend APIs in a unique temporary MongoDB database and starts Vite on port 5181. It requires Microsoft Edge and an existing Playwright installation; it does not install either or add them to application dependencies. Set PLAYWRIGHT_MODULE to the absolute directory of your installed `playwright` package, then run from the project root:

```powershell
node frontend/tests/auth.browser.mjs
```

The test closes its browser and servers and removes only its own database. Screenshots are saved in ignored `frontend/.local/`. It checks validation, registration/login, private-route redirects, refresh, logout, cross-tab logout, invalid tokens, duplicate-email errors, automatic expiry, offline recovery, mobile navigation, and horizontal overflow at 320/768/1440px.

## Transaction UI (Part 6)

`/transactions` now displays the user's live transaction history, with type, category, description, calendar date, and amount. Currency display uses LKR (Sri Lankan rupees). Dates are formatted in UTC to preserve the stored calendar day; a new form defaults to today's local calendar date. No data is fabricated and no new dependencies or environment variables are required.

Use Add transaction to enter income or expense. Edit opens the existing values. Both forms validate type, positive finite amount, category, description length, and calendar date before sending the request. Server validation remains authoritative. Save errors retain the entered values for correction/retry. Native modal dialogs contain keyboard focus, support Escape when idle, and prevent dismissal during a save/delete request.

Search matches description or category. The type selector and exact category text filter combine with search when Apply filters is clicked; Reset clears them. Lists retain active filters after changes, so a successfully saved transaction may be hidden by the current filter. Successful actions reload data from the API. Stale list requests are aborted. Pagination and filtered CSV export are available; see Part 8 below.

Delete first opens an explicit confirmation. Cancel or Escape keeps the record; only Delete transaction sends DELETE. Errors remain in the confirmation for retry. Loading, success, request-failure/retry, and `No transactions found.` states are supported. An API 401 clears the session through the shared authenticated request helper.

### Part 6 verification

From the project root, start the backend and frontend in separate terminals:

```powershell
npm.cmd run dev --prefix backend
```

```powershell
npm.cmd run dev --prefix frontend
```

1. Sign in and open Transactions; a new account should show an empty state.
2. Add income and expenses under different categories. Verify amounts and dates after refresh.
3. Combine search, type, and category filters. Test no results and Reset.
4. Edit amount, description, date, category, and type; verify persisted values.
5. Open Delete and Cancel; confirm the record remains. Then confirm deletion.
6. Submit blank/zero/negative amounts or missing category/date; expect field errors.
7. Stop the backend and apply filters; expect an error and retry option. Restart and retry.
8. Check list/form layouts at 320px, 768px, and desktop; navigate dialogs with keyboard Tab/Escape.
9. Sign in as another user and confirm the first user's records are absent.

```powershell
npm.cmd run build --prefix frontend
npm.cmd test --prefix backend
```

The optional real-browser test uses the same existing Playwright/Edge setup as Part 5. With PLAYWRIGHT_MODULE set to your installed package directory:

```powershell
node frontend/tests/transactions.browser.mjs
node frontend/tests/auth.browser.mjs
```

Tests use temporary isolated MongoDB data, temporary local servers, and headless Edge; cleanup closes these resources and deletes only the test database. The transaction suite covers CRUD, combined filters, reset, validation, persistence, date display, cancelled deletion, failed save/delete recovery, offline retry, unauthorized-session handling, and list/dialog layouts at 320/768/1440px. Screenshots are saved to ignored `frontend/.local/part6-*.png`.

## Dashboard, Budget, and Chart UI (Part 7)

The overview displays all-time income, expenses, balance, current monthly budget, monthly spending progress, up to five recent transactions, and an expenses-by-category horizontal bar chart. The chart uses responsive HTML/CSS with visible category/amount labels; no chart dependency is needed. Bars are scaled relative to the largest category total. Empty accounts show zero totals, no transactions, and a no-expense-data message rather than a fabricated chart.

All financial values come from the existing protected APIs. All-time cards and chart include all recorded dates; the budget uses the server's current UTC calendar month. Currency display is LKR. Negative balances are shown in red. Recent transactions preserve calendar dates and link to the full transaction page. Navigating back to a page fetches current data; Refresh overview/Refresh budget can also reload it.

The budget page supports setting and updating the month's budget, including zero. Empty, negative, and nonfinite values are rejected before submission, with backend validation retained. Saving uses the returned API summary so spending, remaining amount, and percentage update together. Failed saves keep the entered amount and show a recoverable error. Loading and load-error/retry states are provided.

An unset budget is labeled Not set, without a progress bar. A positive budget displays its actual used percentage, even over 100%, while the visible bar is capped at 100%. Overspending is explicitly labeled. A zero budget shows that a percentage is not applicable; any spending still appears as overspending, with a full red bar. This avoids presenting a misleading zero-percent usage indication.

### Part 7 verification

Start both servers from separate terminals at the project root:

```powershell
npm.cmd run dev --prefix backend
```

```powershell
npm.cmd run dev --prefix frontend
```

1. Sign in with an empty account and check zero totals, empty transactions/chart, and an unset budget.
2. Add income of 80000 and current-month expenses of 10000 and 20000 in different categories.
3. Open Overview; expect income 80000, expenses 30000, balance 50000, recent records, and category bars.
4. Save a monthly budget of 50000; expect 20000 remaining and 60% used.
5. Change the budget to 25000; expect 120% used, 5000 overspent, and a capped red bar.
6. Save zero; expect the zero-budget explanation and 30000 overspent without a division error.
7. Refresh and revisit Overview to confirm persistence and updated budget values.
8. Test blank/negative input, failed requests, and retry. Test a second user for isolated totals.
9. Inspect dashboard/chart/budget layouts at 320px, 768px, and desktop widths.

```powershell
npm.cmd run build --prefix frontend
npm.cmd test --prefix backend
```

Using the existing optional Playwright/Edge setup described in Part 5:

```powershell
node frontend/tests/dashboard.browser.mjs
node frontend/tests/auth.browser.mjs
node frontend/tests/transactions.browser.mjs
```

The dashboard suite uses isolated temporary MongoDB data and checks real API totals, empty states, category data, recent transactions, budget validation/create/update, persistence, save failure/retry, zero/overspent budgets, capped progress, API outages, second-user isolation, and responsive widths. Screenshots are saved to ignored `frontend/.local/part7-*.png`. No dependencies or environment changes are required for the application.

## Pagination, CSV Export, and Audit (Part 8)

Required functionality was verified before optional additions. `PART8-AUDIT.md` records the validation, error-handling, ownership, and responsive checks. Improvements include disabled-control feedback, focus on an invalid budget amount, scalable chart maximum calculation, and mobile wrapping for long account names.

### Transaction pagination

`GET /api/transactions` defaults to page 1 and 10 records. `page` must be an integer from 1 to 1000000; `limit` must be an integer from 1 to 100. Empty, repeated, negative, fractional, and malformed values return 400. Search, type, and category filters apply to both the records and their count. Queries remain scoped to the authenticated user.

```json
{
  "success": true,
  "message": "Transactions retrieved",
  "data": {
    "transactions": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "pages": 0 }
  }
}
```

The server clamps an out-of-range page to the last available page (or page 1 for no matches). This recovers when the last record on a page is deleted. Results retain date-descending and ID-descending ordering. The UI displays 10 records, with Previous/Next controls disabled as appropriate. Applying or resetting filters starts at page 1. This changes the old unpaginated list contract; callers must follow pagination to obtain all matches.

### Filtered CSV export

Export CSV downloads **all matching records across all pages**, using the applied filters rather than unsubmitted form text. It uses the existing protected list API in batches of 100 and browser Blob/download APIs. There is no new endpoint or application dependency. Export is disabled during loading, errors, another export, or zero matches. Failed exports show a retry message and do not download partial data. Changing filters or leaving the page cancels an in-progress export.

Only Date, Type, Category, Description, and Amount are included. Dates preserve the stored calendar day; amounts are plain numbers in LKR. Cells are quoted, embedded quotes doubled, line breaks preserved, and UTF-8 BOM/CRLF used for spreadsheet compatibility. Potential formula-leading text is prefixed with an apostrophe so spreadsheet software treats it as text. No user IDs, passwords, or tokens are exported.

Export collects data in browser memory and is intended for this personal-finance assignment. It is not a database snapshot: detected count/duplicate changes during export ask the user to retry, but simultaneous edits preserving record counts cannot all be detected. Avoid editing the dataset in another tab during export.

### Part 8 verification

From the project root:

```powershell
npm.cmd test --prefix frontend
npm.cmd test --prefix backend
npm.cmd run build --prefix frontend
```

With the existing optional Playwright package path configured as PLAYWRIGHT_MODULE and Edge installed:

```powershell
node frontend/tests/pagination.browser.mjs
node frontend/tests/auth.browser.mjs
node frontend/tests/transactions.browser.mjs
node frontend/tests/dashboard.browser.mjs
```

These tests use isolated temporary databases. The Part 8 browser test covers 101 records, previous/next navigation, filtered results, full-dataset and filtered CSV content, formula escaping, another user's exclusion, failed export/retry, empty results, filter reset, last-page deletion recovery, and all five pages at 320/768/1440/1920px with long names/category/description text. Screenshots are saved under ignored `frontend/.local/`.

For manual checks, start the backend and frontend in separate terminals, sign in, create more than ten transactions, and visit Transactions. Check page counts and combined filters; export and compare all matching records rather than only the visible page. Delete the final record on the last page and confirm recovery. Stop/restart the API to check errors and retry. No new environment values or application dependencies are required.
````
