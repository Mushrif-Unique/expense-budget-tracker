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
