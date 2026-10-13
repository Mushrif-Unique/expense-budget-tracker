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

