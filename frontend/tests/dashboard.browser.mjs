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

