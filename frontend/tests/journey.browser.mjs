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
  await mkdir(new URL('../../docs/screenshots/', import.meta.url), { recursive: true });
  const capture = name => page.screenshot({ path: fileURLToPath(new URL(`../../docs/screenshots/${name}.png`, import.meta.url)), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(origin + '/login');
  await page.getByRole('heading', { name: 'Sign in to your space' }).waitFor();
  await capture('login');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Full name').fill('Demo User');
  await page.getByLabel('Email address').fill('demo@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('heading', { name: 'Welcome, Demo User.' }).waitFor();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  for (const [type, amount, category, description] of [['income', 125000, 'Salary', 'Monthly salary'], ['expense', 18000, 'Groceries', 'Weekly essentials'], ['expense', 8500, 'Transport', 'Travel and commuting'], ['expense', 12000, 'Dining', 'Meals with friends']]) {
    await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
    await page.getByLabel('Type', { exact: true }).selectOption(type);
    await page.getByLabel('Amount (LKR)', { exact: true }).fill(String(amount));
    await page.getByLabel('Category', { exact: true }).fill(category);
    await page.getByLabel('Description (optional)').fill(description);
    await page.getByLabel('Date', { exact: true }).fill(date);
    await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('listitem', { name: `${category} transaction`, exact: true }).waitFor();
  }
  await capture('transactions');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  await page.getByRole('link', { name: 'Monthly budget', exact: true }).click();
  await page.getByLabel('Budget amount (LKR)').fill('60000');
  await page.getByRole('button', { name: 'Save budget', exact: true }).click();
  await page.getByText('Monthly budget saved.').waitFor();
  await capture('budget');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('region', { name: 'Balance', exact: true }).getByText('LKR 86,500.00', { exact: true }).waitFor();
  await capture('dashboard');
  assert.equal(await page.locator('.page-enter').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.setViewportSize({ width: 320, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page.getByRole('listitem', { name: 'Groceries transaction', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Email address').fill('demo@example.com');
  await page.getByLabel('Password', { exact: true }).fill('BrowserTest123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Transactions', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.getByRole('region', { name: 'Balance', exact: true }).getByText('LKR 86,500.00', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, []);
  console.info('PASS: complete UI journey: register, create income/expenses, export CSV, set budget, verify balance, mobile navigation, logout/login persistence, reduced motion; four README screenshots captured using isolated demo data.');
} finally {
  if (browser) await browser.close();
  if (vite && vite.exitCode === null) { const exit = once(vite, 'exit'); vite.kill(); await exit; }
  if (api) await new Promise(resolve => api.close(resolve));
  try { if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) await mongoose.connection.dropDatabase(); }
  finally { await mongoose.disconnect(); }
}

