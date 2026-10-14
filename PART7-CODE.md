# Part 7 of 9 — Complete source
Complete new and updated files for the dashboard, monthly budget, and expense chart UI. Each relative path is followed by the complete file contents. The obsolete frontend/src/pages/WorkspacePage.jsx was removed. No application dependencies or environment variables changed. The chart uses responsive HTML/CSS, and all financial data comes from the protected backend APIs. Run and verification commands are in README below.

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
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Your financial overview</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {user.name}.</h1><p className="mt-3 text-slate-500">A clearer view of your everyday finances.</p></div><button onClick={refresh} disabled={loading} className="button-secondary">Refresh overview</button></div>
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
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setSaveError('Enter a budget amount of zero or more.'); return; }
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

## frontend/src/components/BudgetProgress.jsx
````
import { formatAmount } from '../utils/transactions.js';

export function budgetMonth(budget) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(budget.year, budget.month - 1, 1)));
}

export default function BudgetProgress({ budget }) {
  const percentage = budget.progressPercentage ?? 0;
  const visual = budget.amount === 0 && budget.overspent > 0 ? 100 : Math.min(100, Math.max(0, percentage));
  return <section aria-label="Budget progress" className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Monthly spending</h2><span className="text-sm text-slate-500">{budgetMonth(budget)}</span></div>
    <p className="mt-6 break-all text-3xl font-semibold tabular-nums">{formatAmount(budget.monthlyExpenses)}</p>
    <p className="mt-2 text-sm text-slate-500">{budget.isSet ? `of ${formatAmount(budget.amount)} budget` : 'No budget set for this month.'}</p>
    {budget.isSet && <>
      <div role="progressbar" aria-label="Monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={visual} aria-valuetext={budget.amount === 0 ? 'Zero budget; percentage not applicable' : `${percentage}% used`} className="mt-6 h-3 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${budget.overspent > 0 ? 'bg-red-600' : 'bg-emerald-700'}`} style={{ width: `${visual}%` }} /></div>
      <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm"><span className="text-slate-600">{budget.amount === 0 ? 'Zero budget — no percentage to calculate' : `${percentage}% used`}</span><strong className={`break-words ${budget.overspent > 0 ? 'text-red-700' : 'text-emerald-800'}`}>{budget.overspent > 0 ? `Overspent by ${formatAmount(budget.overspent)}` : `${formatAmount(budget.remaining)} remaining`}</strong></div>
    </>}
    <p className="mt-5 text-xs leading-relaxed text-slate-500">Expenses dated in this UTC calendar month. Income does not count toward spending.</p>
  </section>;
}
````

## frontend/src/components/ExpenseChart.jsx
````
import { formatAmount } from '../utils/transactions.js';

export default function ExpenseChart({ categories }) {
  const maximum = Math.max(0, ...categories.map(item => item.total));
  return <figure aria-label="Expenses by category" className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <figcaption className="text-lg font-semibold">Expenses by category</figcaption><p className="mt-1 text-xs text-slate-500">All recorded expenses · LKR</p>
    {maximum === 0 ? <p className="py-10 text-center text-sm text-slate-500">No expense data yet. Add an expense to see your chart.</p> : <ul className="mt-6 space-y-5">{categories.map(item => <li key={item.category}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{item.category}</span><span className="break-all tabular-nums text-slate-600">{formatAmount(item.total)}</span></div><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(0, Math.min(100, item.total / maximum * 100))}%` }} /></div></li>)}</ul>}
  </figure>;
}
````

## frontend/src/components/ApiState.jsx
````
export default function ApiState({ loading, error, onRetry }) {
  if (loading) return <p role="status" className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-slate-600">Loading your finances…</p>;
  return <div className="mt-8 rounded-2xl border border-red-200 bg-white p-6"><p role="alert" className="text-red-700">{error}</p><button className="button-secondary mt-4" onClick={onRetry}>Try again</button></div>;
}
````

## frontend/src/hooks/useApiData.js
````
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function useApiData(path) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: '' });
    request(path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ data: result.data, loading: false, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [path, request, revision]);
  return { ...state, refresh };
}
````

## frontend/src/App.jsx
````
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute, { SessionState } from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
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
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/budget" element={<BudgetPage />} />
    </Route></Route>
    <Route path="*" element={<main className="min-h-screen bg-stone-50 p-8"><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="mt-6 inline-block text-emerald-800 underline">Return home</Link></main>} />
  </Routes></AuthProvider>;
}
````

## frontend/tests/dashboard.browser.mjs
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
  const registration = await fetch(apiUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Dashboard Tester', email: 'dashboard@example.com', password: 'BrowserTest123!' }) });
  const identity = (await registration.json()).data;
  const headers = { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' };
  await page.goto(origin + '/login');
  await page.getByLabel('Email address').fill('dashboard@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('No expense data yet. Add an expense to see your chart.').waitFor();
  await page.getByText('No transactions yet. Add your first income or expense.').waitFor();
  assert.ok((await page.getByRole('region', { name: 'Total income', exact: true }).innerText()).includes('0.00'));
  await page.getByRole('link', { name: 'Manage monthly budget' }).click();
  await page.getByText('No budget set for this month.').waitFor();
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Enter a budget amount of zero or more.' }).waitFor();
  await page.getByLabel('Budget amount (LKR)').fill('-1');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Enter a budget amount of zero or more.' }).waitFor();
  await page.getByLabel('Budget amount (LKR)').fill('50000');
  await page.route('**/api/budgets/current', route => route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Test save failure' }) }) : route.continue());
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Test save failure' }).waitFor();
  assert.equal(await page.getByLabel('Budget amount (LKR)').inputValue(), '50000');
  await page.unroute('**/api/budgets/current');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByText('Monthly budget saved.').waitFor();
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  for (const [type, amount, category] of [['income', 80000, 'Salary'], ['expense', 10000, 'Food'], ['expense', 20000, 'Travel']]) {
    const response = await fetch(apiUrl + '/transactions', { method: 'POST', headers, body: JSON.stringify({ type, amount, category, description: `${category} entry`, date }) });
    assert.equal(response.status, 201);
  }
  await page.getByRole('button', { name: 'Refresh budget' }).click();
  await page.getByText('60% used', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  const total = (label, amount) => page.getByRole('region', { name: label, exact: true }).getByText(amount, { exact: true }).waitFor();
  await total('Total income', 'LKR 80,000.00');
  await total('Total expenses', 'LKR 30,000.00');
  await total('Balance', 'LKR 50,000.00');
  await page.getByRole('figure', { name: 'Expenses by category' }).getByText('Food', { exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Recent transactions' }).getByRole('listitem').count(), 3);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Dashboard overflow at ${width}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../.local/part7-dashboard-${width}.png`, import.meta.url)), fullPage: true });
  }
  await page.getByRole('link', { name: 'Manage monthly budget' }).click();
  await page.getByLabel('Budget amount (LKR)').fill('25000');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByText('120% used', { exact: true }).waitFor();
  await page.getByText('Overspent by LKR 5,000.00', { exact: true }).waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Budget overflow at ${width}`);
    await page.screenshot({ path: fileURLToPath(new URL(`../.local/part7-budget-${width}.png`, import.meta.url)), fullPage: true });
  }
  await page.getByLabel('Budget amount (LKR)').fill('0');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByText('Zero budget — no percentage to calculate', { exact: true }).waitFor();
  await page.getByText('Overspent by LKR 30,000.00', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Zero budget — no percentage to calculate', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Budget amount (LKR)').inputValue(), '0');
  await page.route('**/api/budgets/current', route => route.abort());
  await page.getByRole('button', { name: 'Refresh budget' }).click();
  await page.getByRole('alert').filter({ hasText: 'Cannot reach the server' }).waitFor();
  await page.unroute('**/api/budgets/current');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByLabel('Budget amount (LKR)').waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await total('Monthly budget', 'LKR 0.00');
  await page.route('**/api/dashboard/summary', route => route.abort());
  await page.getByRole('button', { name: 'Refresh overview' }).click();
  await page.getByRole('alert').filter({ hasText: 'Cannot reach the server' }).waitFor();
  await page.unroute('**/api/dashboard/summary');
  await page.getByRole('button', { name: 'Try again' }).click();
  await total('Total expenses', 'LKR 30,000.00');
  const second = await fetch(apiUrl + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Other User', email: 'other@example.com', password: 'BrowserTest123!' }) });
  assert.equal(second.status, 201);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Email address').fill('other@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('No expense data yet. Add an expense to see your chart.').waitFor();
  await total('Balance', 'LKR 0.00');
  assert.deepEqual(pageErrors, []);
  console.info('PASS: dashboard/budget browser checks: empty states, totals/chart, recent transactions, budget create/update/persistence, validation, save failure/retry, zero/overspent budgets, capped bars, API outages, two-user isolation, and 320/768/1440px layouts.');
} finally {
  if (browser) await browser.close();
  if (vite && vite.exitCode === null) { const exit = once(vite, 'exit'); vite.kill(); await exit; }
  if (api) await new Promise(resolve => api.close(resolve));
  try { if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase(); }
  finally { await mongoose.disconnect(); }
}
````

## frontend/tests/auth.browser.mjs
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
  await page.goto(origin + '/transactions');
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('Enter a valid email address.').waitFor();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Full name').fill('Browser Tester');
  await page.getByLabel('Email address').fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByText('Use at least 8 characters.').waitFor();
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('heading', { name: 'Transactions', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Transactions', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome, Browser Tester.' }).waitFor();
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../.local/part5-desktop.png', import.meta.url)), fullPage: true });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}`);
    if (width === 320) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('link', { name: 'Monthly budget', exact: true }).click();
      await page.getByRole('heading', { name: 'Monthly budget', exact: true }).waitFor();
      await page.screenshot({ path: fileURLToPath(new URL('../.local/part5-mobile.png', import.meta.url)), fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('expense-tracker-token')), null);
  await page.getByLabel('Email address').fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Invalid email or password.' }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Log out' }).waitFor();
  await page.route('**/api/auth/me', route => route.abort());
  await page.reload();
  await page.getByRole('heading', { name: 'Unable to restore your session' }).waitFor();
  assert.ok(await page.evaluate(() => Boolean(localStorage.getItem('expense-tracker-token'))));
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('button', { name: 'Log out' }).waitFor();
  const other = await page.context().newPage(); await other.goto(origin + '/dashboard');
  await other.getByRole('button', { name: 'Log out' }).waitFor();
  await page.getByRole('button', { name: 'Log out' }).click();
  await other.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  await page.evaluate(() => localStorage.setItem('expense-tracker-token', 'invalid-token'));
  await page.goto(origin + '/budget');
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('expense-tracker-token')), null);
  await page.goto(origin + '/register');
  await page.getByLabel('Full name').fill('Duplicate');
  await page.getByLabel('Email address').fill('browser@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'An account with this email already exists.' }).waitFor();
  const testUser = await User.findOne({ email: 'browser@example.com' });
  const shortToken = requireBackend('jsonwebtoken').sign({}, process.env.JWT_SECRET, { subject: testUser.id, expiresIn: '4s', algorithm: 'HS256' });
  await page.evaluate(token => localStorage.setItem('expense-tracker-token', token), shortToken);
  await page.goto(origin + '/dashboard');
  await page.getByRole('button', { name: 'Log out' }).waitFor();
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Auth no overflow at ${width}`);
  }
  await page.screenshot({ path: fileURLToPath(new URL('../.local/part5-login.png', import.meta.url)), fullPage: true });
  assert.deepEqual(pageErrors, []);
  console.info('PASS: browser registration, validation, login errors, protected redirects, refresh persistence, logout, cross-tab logout, invalid tokens, offline recovery, mobile navigation, and 320/768/1440px overflow checks.');
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

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–7: Backend APIs and Complete Core Financial UI**.

## Features

Implemented: responsive login/registration pages, persistent authentication, protected application layout and navigation, logout, Express API, MongoDB connection configuration, backend authentication, user-owned transaction APIs with search and filters, monthly budgets, dashboard calculations, and a live transaction UI with forms, search, filters, and delete confirmation.

Planned for Parts 8–9: validation and responsive audits, pagination, CSV export, final testing, and submission documentation.

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

Parts 1–7 implemented (7/9). Next: Part 8 validation/responsive audits, followed by pagination and CSV export after required functionality is verified. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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
````
