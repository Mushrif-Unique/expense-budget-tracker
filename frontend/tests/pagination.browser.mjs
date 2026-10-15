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
