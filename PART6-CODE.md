# Part 6 of 9 — Complete source
Complete new and updated files for the transaction UI. Paths are relative to the project root, followed by the full file contents. Backend APIs and application dependencies are unchanged. Run and verification commands are included in README below. Currency display is LKR and stored transaction dates are preserved. Pagination/export remain Part 8 work.

## frontend/src/pages/TransactionsPage.jsx
````
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import Modal from '../components/Modal.jsx';
import { formatAmount, formatDate } from '../utils/transactions.js';

const emptyFilters = { search: '', type: '', category: '' };
export default function TransactionsPage() {
  const { request } = useAuth();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [revision, setRevision] = useState(0);
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
    request(`/transactions?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setTransactions(result.data.transactions); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision, request]);
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
  function apply(event) {
    event.preventDefault(); setNotice('');
    setFilters({ search: draft.search.trim(), type: draft.type, category: draft.category.trim() });
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Income & expenses</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Transactions</h1><p className="mt-3 text-slate-500">Keep track of the money coming in and going out.</p></div><button className="button-primary" onClick={() => { setNotice(''); setEditor({ transaction: null }); }}>Add transaction</button></div>
    {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice} Active filters still apply.</p>}
    <form onSubmit={apply} className="mt-8 grid items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 xl:grid-cols-[2fr_1fr_1fr_auto]">
      <div><label htmlFor="search" className="mb-2 block text-sm font-medium">Search</label><input id="search" className="form-input" placeholder="Description or category" maxLength={100} value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></div>
      <div><label htmlFor="filter-type" className="mb-2 block text-sm font-medium">Filter by type</label><select id="filter-type" className="form-input" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
      <div><label htmlFor="filter-category" className="mb-2 block text-sm font-medium">Filter by category</label><input id="filter-category" placeholder="All categories" className="form-input" maxLength={100} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></div>
      <div className="flex flex-wrap gap-2"><button className="button-primary">Apply filters</button><button type="button" className="button-secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setNotice(''); }}>Reset</button></div>
    </form>
    <section aria-label="Transaction history" aria-busy={loading} className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">Transaction history</h2><p className="mt-1 text-xs text-slate-500">Newest transaction dates first · Amounts in LKR</p></div>
      {loading ? <p role="status" className="p-8 text-slate-500">Loading transactions…</p> : error ? <div className="p-6"><p role="alert" className="text-red-700">{error}</p><button className="button-secondary mt-4" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : transactions.length === 0 ? <div className="p-8 text-center"><p className="font-medium">No transactions found.</p><p className="mt-2 text-sm text-slate-500">Add a transaction or adjust your filters.</p></div> : <ul className="divide-y divide-stone-100">{transactions.map(transaction => <li key={transaction._id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center" aria-label={`${transaction.category} transaction`}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>{transaction.type === 'income' ? 'Income' : 'Expense'}</span><span className="break-words font-medium [overflow-wrap:anywhere]">{transaction.category}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{transaction.description || 'No description'}</p><time dateTime={transaction.date.slice(0, 10)} className="mt-2 block text-xs text-slate-500">{formatDate(transaction.date)}</time></div>
        <p className={`break-all font-semibold tabular-nums ${transaction.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}>{transaction.type === 'income' ? '+' : '−'}{formatAmount(transaction.amount)}</p>
        <div className="flex gap-2"><button className="button-secondary" onClick={() => setEditor({ transaction })}>Edit</button><button className="button-secondary text-red-700" onClick={() => { setDeleteError(''); setDeleting(transaction); }}>Delete</button></div>
      </li>)}</ul>}
    </section>
    {editor && <TransactionForm transaction={editor.transaction} onSave={save} onClose={() => setEditor(null)} />}
    {deleting && <Modal title="Delete transaction?" busy={deleteBusy} onClose={() => setDeleting(null)}><p className="break-words text-slate-600">Delete the {deleting.category} transaction for {formatAmount(deleting.amount)}? This cannot be undone.</p>{deleteError && <p role="alert" className="mt-4 text-red-700">{deleteError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button className="button-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button className="button-primary bg-red-700 hover:bg-red-800" disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Deleting…' : 'Delete transaction'}</button></div></Modal>}
  </>;
}
````

## frontend/src/components/TransactionForm.jsx
````
import { useState } from 'react';
import Modal from './Modal.jsx';
import { todayDate, validateTransactionForm } from '../utils/transactions.js';

export default function TransactionForm({ transaction, onSave, onClose }) {
  const [values, setValues] = useState({ type: transaction?.type || 'expense', amount: transaction ? String(transaction.amount) : '', category: transaction?.category || '', description: transaction?.description || '', date: transaction?.date.slice(0, 10) || todayDate() });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const props = field => ({ id: `transaction-${field}`, name: field, value: values[field], disabled: busy, onChange: event => setValues({ ...values, [field]: event.target.value }), 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${field}-error` : undefined, className: 'form-input' });
  async function submit(event) {
    event.preventDefault();
    const next = validateTransactionForm(values);
    setErrors(next); setMessage('');
    if (Object.keys(next).length) { document.getElementById(`transaction-${Object.keys(next)[0]}`)?.focus(); return; }
    setBusy(true);
    try { await onSave({ ...values, amount: Number(values.amount), category: values.category.trim(), description: values.description.trim() }); }
    catch (error) { setMessage(error.message); setBusy(false); }
  }
  return <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} busy={busy} onClose={onClose}>
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy}>
      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
      {['type', 'amount', 'category', 'description', 'date'].map(field => <div key={field}>
        <label htmlFor={`transaction-${field}`} className="mb-2 block text-sm font-medium">{({ type: 'Type', amount: 'Amount (LKR)', category: 'Category', description: 'Description (optional)', date: 'Date' })[field]}</label>
        {field === 'type' ? <select {...props(field)}><option value="expense">Expense</option><option value="income">Income</option></select> : field === 'description' ? <textarea {...props(field)} rows={3} maxLength={1000} /> : <input {...props(field)} type={field === 'amount' ? 'number' : field === 'date' ? 'date' : 'text'} step={field === 'amount' ? 'any' : undefined} inputMode={field === 'amount' ? 'decimal' : undefined} required maxLength={field === 'category' ? 100 : undefined} />}
        {errors[field] && <p id={`${field}-error`} className="mt-1 text-sm text-red-700">{errors[field]}</p>}
      </div>)}
      <div className="flex flex-wrap justify-end gap-3 pt-3"><button type="button" disabled={busy} onClick={onClose} className="button-secondary">Cancel</button><button disabled={busy} className="button-primary">{busy ? 'Saving…' : 'Save transaction'}</button></div>
    </form>
  </Modal>;
}
````

## frontend/src/components/Modal.jsx
````
import { useEffect, useRef } from 'react';

export default function Modal({ title, children, busy = false, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><h2 id="modal-title" className="text-xl font-semibold">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose} className="rounded px-2 text-xl disabled:opacity-40">×</button></div>
    {children}
  </dialog>;
}
````

## frontend/src/utils/transactions.js
````
export function validateTransactionForm(values) {
  const errors = {};
  if (!['income', 'expense'].includes(values.type)) errors.type = 'Choose income or expense.';
  if (!values.amount.trim() || !Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) errors.amount = 'Enter an amount greater than zero.';
  if (!values.category.trim() || values.category.trim().length > 100) errors.category = 'Enter a category of 1–100 characters.';
  if (values.description.trim().length > 1000) errors.description = 'Use at most 1000 characters.';
  const date = new Date(`${values.date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.date) errors.date = 'Enter a valid calendar date.';
  return errors;
}
export const formatAmount = amount => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
export const formatDate = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
export function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
````

## frontend/src/App.jsx
````
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute, { SessionState } from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';

function HomeRedirect() {
  const { status } = useAuth();
  if (status === 'loading' || status === 'error') return <SessionState />;
  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route path="/dashboard" element={<WorkspacePage section="dashboard" />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/budget" element={<WorkspacePage section="budget" />} />
    </Route></Route>
    <Route path="*" element={<main className="min-h-screen bg-stone-50 p-8"><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="mt-6 inline-block text-emerald-800 underline">Return home</Link></main>} />
  </Routes></AuthProvider>;
}
````

## frontend/src/context/AuthContext.jsx
````
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/api.js';

const AuthContext = createContext(null);
const storageKey = 'expense-tracker-token';
const readToken = () => { try { return localStorage.getItem(storageKey); } catch { return null; } };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => readToken() ? 'loading' : 'guest');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const currentToken = useRef(token);

  const logout = useCallback(() => {
    generation.current++;
    currentToken.current = null;
    try { localStorage.removeItem(storageKey); } catch { /* Session is still cleared in memory. */ }
    setToken(null); setUser(null); setStatus('guest'); setError('');
  }, []);

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== storageKey && event.key !== null) return;
      generation.current++;
      const next = readToken();
      currentToken.current = next;
      setUser(null); setToken(next); setError(''); setStatus(next ? 'loading' : 'guest');
      setAttempt(value => value + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const version = generation.current;
    setStatus('loading'); setError('');
    apiRequest('/auth/me', { token, signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted && version === generation.current) { setUser(result.data.user); setStatus('authenticated'); }
      })
      .catch(failure => {
        if (controller.signal.aborted || version !== generation.current) return;
        if (failure.status === 401) logout();
        else { setError(failure.message); setStatus('error'); }
      });
    return () => controller.abort();
  }, [token, attempt, logout]);

  useEffect(() => {
    if (!token || status !== 'authenticated') return;
    try {
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(encoded));
      if (!Number.isFinite(exp)) { logout(); return; }
      const remaining = exp * 1000 - Date.now();
      if (remaining <= 0) { logout(); return; }
      const timeout = setTimeout(logout, Math.min(remaining, 2147483647));
      return () => clearTimeout(timeout);
    } catch { logout(); }
  }, [token, status, logout]);
  async function authenticate(mode, values) {
    const version = generation.current;
    const result = await apiRequest(`/auth/${mode}`, { method: 'POST', body: values });
    if (version !== generation.current) return;
    try { localStorage.setItem(storageKey, result.data.token); }
    catch { throw new Error('Browser storage is unavailable. Enable site storage and try signing in again.'); }
    currentToken.current = result.data.token;
    setToken(result.data.token); setUser(result.data.user); setStatus('authenticated'); setError('');
  }

  const request = useCallback(async (path, options = {}) => {
    const requestToken = currentToken.current;
    try { return await apiRequest(path, { ...options, token: requestToken }); }
    catch (failure) {
      if (failure.status === 401 && currentToken.current === requestToken) logout();
      throw failure;
    }
  }, [logout]);

  return <AuthContext.Provider value={{ user, status, error, authenticate, logout, request, retry: () => setAttempt(value => value + 1) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
````

## frontend/src/pages/WorkspacePage.jsx
````
import { useAuth } from '../context/AuthContext.jsx';

export default function WorkspacePage({ section }) {
  const { user } = useAuth();
  const details = {
    dashboard: ['Your personal workspace', `Welcome, ${user.name}.`, 'You are signed in securely. Your financial overview and charts are coming soon.'],
    budget: ['Plan your month', 'Monthly budget', 'Budget planning is coming soon. This will be your space to track monthly spending and progress.'],
  };
  const [eyebrow, title, message] = details[section];
  return <><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">{eyebrow}</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><section className="mt-8 max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><p className="leading-relaxed text-slate-600">{message}</p>{section === 'dashboard' && <div className="mt-6 border-t border-stone-100 pt-6"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">Signed in as</p><p className="mt-2 break-all font-medium">{user.email}</p></div>}</section></>;
}
````

## frontend/tests/transactions.browser.mjs
````
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
  const registration = await fetch(apiUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Transaction Tester', email: 'transactions@example.com', password: 'BrowserTest123!' }) });
  assert.equal(registration.status, 201);
  await page.goto(origin + '/transactions');
  await page.getByLabel('Email address').fill('transactions@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('No transactions found.').waitFor();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText('Enter an amount greater than zero.').waitFor();
  await page.getByText('Enter a category of 1–100 characters.').waitFor();
  await page.getByLabel('Amount (LKR)', { exact: true }).fill('-5');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText('Enter an amount greater than zero.').waitFor();
  await page.getByLabel('Amount (LKR)', { exact: true }).fill('125.50');
  await page.getByLabel('Category', { exact: true }).fill('Food');
  await page.getByLabel('Description (optional)').fill('Lunch at the cafe');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-12');
  await page.route('**/api/transactions', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test save failure' }) }) : route.continue());
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByRole('alert').filter({ hasText: 'Test save failure' }).waitFor();
  assert.equal(await page.getByLabel('Amount (LKR)', { exact: true }).inputValue(), '125.50');
  await page.unroute('**/api/transactions');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  const food = page.getByRole('listitem', { name: 'Food transaction' });
  await food.waitFor();
  assert.ok((await food.innerText()).includes('12 Oct 2026'));
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await page.getByLabel('Type', { exact: true }).selectOption('income');
  await page.getByLabel('Amount (LKR)', { exact: true }).fill('50000');
  await page.getByLabel('Category', { exact: true }).fill('Salary');
  await page.getByLabel('Date', { exact: true }).fill('2026-10-13');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByRole('listitem', { name: 'Salary transaction' }).waitFor();
  await page.getByLabel('Search', { exact: true }).fill('lunch');
  await page.getByLabel('Filter by type').selectOption('expense');
  await page.getByLabel('Filter by category').fill('food');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('listitem', { name: 'Salary transaction' }).waitFor({ state: 'hidden' });
  await food.waitFor();
  await page.getByLabel('Search', { exact: true }).fill('absent');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByText('No transactions found.').waitFor();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await food.waitFor();
  await food.getByRole('button', { name: 'Edit', exact: true }).click();
  assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '2026-10-12');
  await page.getByLabel('Amount (LKR)', { exact: true }).fill('150');
  await page.getByLabel('Description (optional)').fill('Updated lunch');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await food.getByText('Updated lunch', { exact: true }).waitFor();
  await page.reload(); await food.getByText('Updated lunch', { exact: true }).waitFor();
  await food.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await food.waitFor();
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `List overflow at ${width}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../.local/part6-${width}.png`, import.meta.url)), fullPage: true });
    await food.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.ok(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth), `Dialog overflow at ${width}`);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  await food.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.route('**/api/transactions/*', route => route.request().method() === 'DELETE' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test delete failure' }) }) : route.continue());
  await page.getByRole('button', { name: 'Delete transaction', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Test delete failure' }).waitFor();
  await page.unroute('**/api/transactions/*');
  await page.getByRole('button', { name: 'Delete transaction', exact: true }).click();
  await food.waitFor({ state: 'hidden' });
  await page.route('**/api/transactions?*', route => route.abort());
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('alert').filter({ hasText: 'Cannot reach the server' }).waitFor();
  await page.unroute('**/api/transactions?*');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('listitem', { name: 'Salary transaction' }).waitFor();
  await page.route('**/api/transactions?*', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Session expired' }) }));
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.info('PASS: transaction browser CRUD, combined filters/reset, validation, refresh, dates, delete cancellation, failed-save/delete recovery, offline retry, 401 logout, responsive list/dialogs, and keyboard dismissal.');
} finally {
  if (browser) await browser.close();
  if (vite && vite.exitCode === null) { const exit = once(vite, 'exit'); vite.kill(); await exit; }
  if (api) await new Promise(resolve => api.close(resolve));
  try { if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase(); }
  finally { await mongoose.disconnect(); }
}
````

## README.md
````
# Expense & Budget Tracker

## Project Overview

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–6: Backend APIs, Frontend Authentication/Layout, and Transaction UI**.

## Features

Implemented: responsive login/registration pages, persistent authentication, protected application layout and navigation, logout, Express API, MongoDB connection configuration, backend authentication, user-owned transaction APIs with search and filters, monthly budgets, dashboard calculations, and a live transaction UI with forms, search, filters, and delete confirmation.

Planned for Parts 7–9: budget pages, dashboard and charts, validation, pagination, CSV export, and submission documentation.

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

Open http://localhost:5173. Guests are redirected to the sign-in page. Register or sign in to open the protected workspace. The transaction page is live. Dashboard and budget pages are scheduled for Part 7; no financial values are fabricated.

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

Parts 1–6 implemented (6/9). Next: Part 7 dashboard, monthly budget, and expense chart UI. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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

Blank search/category values are ignored. Invalid or repeated filter values return 400. Pagination is deferred to Part 8; unknown query keys are rejected. Empty results return an empty array. Malformed IDs return 400; missing/other-user IDs return 404. Unauthorized calls return 401. These APIs are intended for the Part 6 frontend transaction page.

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

Create current-month transactions using Part 3's examples and verify the totals manually. Repeating PUT updates the same monthly record. Test with a second account to confirm its totals/budget are separate. If startup reports an index error, check database permissions and any duplicate existing user/month/year budget documents; do not delete application data blindly. Budget/dashboard pages are scheduled for Part 7.

## Frontend Authentication and Layout (Part 5)

Routes: `/login`, `/register`, `/dashboard`, `/transactions`, and `/budget`. `/` redirects according to authentication state. Guests visiting a protected route are returned to that route after successful authentication. Unknown routes retain a page-not-found screen. The authenticated navigation includes desktop links, a collapsible mobile menu, and logout. The transaction page is implemented; the overview and budget pages remain scheduled for Part 7. The overview currently shows the real signed-in user's name and email only.

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

Search matches description or category. The type selector and exact category text filter combine with search when Apply filters is clicked; Reset clears them. Lists retain active filters after changes, so a successfully saved transaction may be hidden by the current filter. Successful actions reload data from the API. Stale list requests are aborted. Pagination and CSV export remain Part 8 work.

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
````
