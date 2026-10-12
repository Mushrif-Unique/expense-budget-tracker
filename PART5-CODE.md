# Part 5 of 9 — Complete source
Complete new and updated files for frontend authentication and the protected application layout. Each relative file path is followed by its complete code. The obsolete frontend/src/pages/HomePage.jsx was removed; its historical source remains in PART1-CODE.md. No application packages or environment changes are needed. Financial pages are intentionally scheduled for Parts 6–7 and use no fabricated financial data. Screenshots from browser checks are in ignored frontend/.local/. Run and manual testing instructions are included in README below.

## frontend/src/App.jsx
````
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute, { SessionState } from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';

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
      <Route path="/transactions" element={<WorkspacePage section="transactions" />} />
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

  async function request(path, options = {}) {
    const requestToken = currentToken.current;
    try { return await apiRequest(path, { ...options, token: requestToken }); }
    catch (failure) {
      if (failure.status === 401 && currentToken.current === requestToken) logout();
      throw failure;
    }
  }

  return <AuthContext.Provider value={{ user, status, error, authenticate, logout, request, retry: () => setAttempt(value => value + 1) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
````

## frontend/src/components/ProtectedRoute.jsx
````
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function SessionState() {
  const { status, error, retry, logout } = useAuth();
  return <main className="grid min-h-screen place-items-center bg-stone-50 px-6">
    <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8" aria-live="polite">
      <h1 className="text-xl font-semibold">{status === 'error' ? 'Unable to restore your session' : 'Checking your session…'}</h1>
      {status === 'error' && <><p role="alert" className="mt-3 text-slate-600">{error}</p><div className="mt-6 flex flex-wrap gap-3"><button className="button-primary" onClick={retry}>Try again</button><button className="button-secondary" onClick={logout}>Back to sign in</button></div></>}
    </section>
  </main>;
}

export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'error') return <SessionState />;
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}
````

## frontend/src/layouts/AppLayout.jsx
````
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [['/dashboard', 'Overview'], ['/transactions', 'Transactions'], ['/budget', 'Monthly budget']];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const title = links.find(([path]) => path === location.pathname)?.[1] || 'Your workspace';
  return <div className="min-h-screen bg-stone-50 text-slate-900 md:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <aside className="flex shrink-0 flex-col border-b border-stone-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-3 p-5 md:p-7"><NavLink to="/dashboard" className="flex min-w-0 items-center gap-3 font-semibold"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-900 text-white">E</span><span className="text-sm">Expense &<br />Budget Tracker</span></NavLink><button className="button-secondary md:hidden" aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button></div>
      <nav id="app-navigation" aria-label="Main navigation" className={`${menu ? 'block' : 'hidden'} px-4 pb-5 md:block md:mt-5`}>
        {links.map(([path, label]) => <NavLink key={path} to={path} onClick={() => setMenu(false)} className={({ isActive }) => `mb-2 block rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-stone-100'}`}>{label}</NavLink>)}
      </nav>
      <div className="hidden mt-auto p-7 text-xs leading-relaxed text-slate-500 md:block">Small steps toward<br />a clearer financial picture.</div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-5 sm:px-10"><p className="text-sm font-medium text-slate-600">{title}</p><div className="flex min-w-0 items-center gap-4"><span className="max-w-40 truncate text-sm font-medium" title={user.name}>{user.name}</span><button onClick={logout} className="button-secondary shrink-0">Log out</button></div></header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-10 sm:px-10"><Outlet /></main>
    </div>
  </div>;
}
````

## frontend/src/pages/AuthPage.jsx
````
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { SessionState } from '../components/ProtectedRoute.jsx';
import { validateAuth } from '../utils/authValidation.js';

export default function AuthPage({ mode }) {
  const register = mode === 'register';
  const { status, authenticate } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const destination = ['/dashboard', '/transactions', '/budget'].includes(location.state?.from) ? location.state.from : '/dashboard';
  if (status === 'loading' || status === 'error') return <SessionState />;
  if (status === 'authenticated') return <Navigate to={destination} replace />;

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateAuth(values, register);
    setErrors(nextErrors); setMessage('');
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setBusy(true);
    try { await authenticate(mode, { ...(register ? { name: values.name.trim() } : {}), email: values.email.trim(), password: values.password }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-stone-50 text-slate-900 lg:grid lg:grid-cols-2">
    <section className="relative flex flex-col justify-between bg-emerald-950 px-6 py-8 text-white sm:px-12 lg:min-h-screen lg:p-16">
      <Link to="/" className="flex items-center gap-3 text-sm font-semibold"><span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xl">E</span>Expense & Budget Tracker</Link>
      <div className="my-10 max-w-lg lg:my-20"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">A little clarity, every day</p><h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Make room for<br />what matters.</h1><p className="mt-5 max-w-sm leading-relaxed text-emerald-100/80">A personal space for your income, spending, and monthly plans.</p></div>
      <p className="hidden text-sm text-emerald-200/70 lg:block">Your finances. Your pace.</p>
    </section>
    <section className="flex items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-md"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Welcome{register ? '' : ' back'}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{register ? 'Create your account' : 'Sign in to your space'}</h2><p className="mt-3 text-slate-500">{register ? 'Start with a few details. Keep everything in one place.' : 'Pick up where you left off.'}</p>
        <form className="mt-8 space-y-5" noValidate onSubmit={submit} aria-busy={busy}>
          {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</p>}
          {(register ? ['name', 'email', 'password'] : ['email', 'password']).map(field => <div key={field}>
            <label htmlFor={field} className="mb-2 block text-sm font-medium">{field === 'name' ? 'Full name' : field === 'email' ? 'Email address' : 'Password'}</label>
            <input id={field} name={field} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? (register ? 'new-password' : 'current-password') : field} required disabled={busy} value={values[field]} onChange={event => setValues({ ...values, [field]: event.target.value })} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : field === 'password' && register ? 'password-hint' : undefined} className="form-input" />
            {errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{errors[field]}</p>}
            {field === 'password' && register && !errors.password && <p id="password-hint" className="mt-2 text-xs text-slate-500">Use at least 8 characters.</p>}
          </div>)}
          <button type="submit" disabled={busy} className="button-primary w-full">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{register ? 'Already have an account? ' : 'New here? '}<Link className="font-semibold text-emerald-800 underline underline-offset-4" state={location.state} to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </div>
    </section>
  </main>;
}
````

## frontend/src/pages/WorkspacePage.jsx
````
import { useAuth } from '../context/AuthContext.jsx';

export default function WorkspacePage({ section }) {
  const { user } = useAuth();
  const details = {
    dashboard: ['Your personal workspace', `Welcome, ${user.name}.`, 'You are signed in securely. Your financial overview and charts are coming soon.'],
    transactions: ['Income & expenses', 'Transactions', 'Your transaction tools are coming soon. This will be your space to review income and spending.'],
    budget: ['Plan your month', 'Monthly budget', 'Budget planning is coming soon. This will be your space to track monthly spending and progress.'],
  };
  const [eyebrow, title, message] = details[section];
  return <><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">{eyebrow}</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><section className="mt-8 max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><p className="leading-relaxed text-slate-600">{message}</p>{section === 'dashboard' && <div className="mt-6 border-t border-stone-100 pt-6"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">Signed in as</p><p className="mt-2 break-all font-medium">{user.email}</p></div>}</section></>;
}
````

## frontend/src/utils/authValidation.js
````
export function validateAuth(values, register) {
  const errors = {};
  if (register && (!values.name.trim() || values.name.trim().length > 100)) errors.name = 'Enter a name of 1–100 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (register && values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (new TextEncoder().encode(values.password).length > 72) errors.password = 'Password must be at most 72 UTF-8 bytes.';
  return errors;
}
````

## frontend/src/services/api.js
````
export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (!base) throw new ApiError('The API address is not configured.');
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw new ApiError(result?.message || 'The server could not complete your request.', response.status);
  return result;
}

export const getHealth = signal => apiRequest('/health', { signal });
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
  .button-secondary { @apply rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50; }
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
      await page.getByRole('link', { name: 'Monthly budget' }).click();
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

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–5: Backend APIs and Frontend Authentication/Layout**.

## Features

Implemented: responsive login/registration pages, persistent authentication, protected application layout and navigation, logout, Express API, MongoDB connection configuration, backend authentication, user-owned transaction APIs with search and filters, monthly budgets, and dashboard calculations.

Planned for Parts 6–9: transaction and budget pages, dashboard and charts, validation, pagination, CSV export, and submission documentation.

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

Open http://localhost:5173. Guests are redirected to the sign-in page. Register or sign in to open the protected workspace. Financial pages are staged for Parts 6–7; no financial values are fabricated.

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

Parts 1–5 implemented (5/9). Next: Part 6 transaction UI: create, edit, delete, history, search, and filters. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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

Routes: `/login`, `/register`, `/dashboard`, `/transactions`, and `/budget`. `/` redirects according to authentication state. Guests visiting a protected route are returned to that route after successful authentication. Unknown routes retain a page-not-found screen. The authenticated navigation includes desktop links, a collapsible mobile menu, and logout. Financial pages are explicitly marked for their scheduled parts; the overview shows the real signed-in user's name and email only.

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
````
