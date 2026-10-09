# Part 4 of 9 — Complete source
Complete new and updated files for monthly budgets and the dashboard backend. Each relative path is followed by its full contents. No new dependencies or environment changes are required. Verification: 41 budget/dashboard API checks, 85 transaction checks, and 28 authentication checks passed, along with backend syntax, frontend production build, MongoDB connectivity, and actual backend startup. Frontend financial pages remain scheduled for later parts. Run/manual verification commands and API contracts are included in the README below.

## backend/models/Budget.js
````
import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  month: { type: Number, required: true, min: 1, max: 12, validate: Number.isInteger },
  year: { type: Number, required: true, min: 1, max: 9999, validate: Number.isInteger },
  amount: { type: Number, required: true, validate: { validator: value => Number.isFinite(value) && value >= 0, message: 'Budget must be a finite nonnegative number.' } },
}, { timestamps: true });

budgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });
export default mongoose.model('Budget', budgetSchema);
````

## backend/controllers/budgetController.js
````
import Budget from '../models/Budget.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { currentMonth } from '../utils/finance.js';

export async function getCurrentBudget(req, res) {
  const budget = await getBudgetSummary(req.user.id);
  return res.json({ success: true, message: 'Current monthly budget retrieved', data: { budget } });
}

export async function setCurrentBudget(req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'amount') || typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0) {
    return res.status(400).json({ success: false, message: 'Supply only amount as a finite number greater than or equal to zero.' });
  }
  const period = currentMonth();
  const filter = { user: req.user.id, month: period.month, year: period.year };
  try {
    await Budget.findOneAndUpdate(filter, { $set: { amount: body.amount } }, { upsert: true, runValidators: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Concurrent first saves can race on the unique monthly index.
    await Budget.findOneAndUpdate(filter, { $set: { amount: body.amount } }, { runValidators: true, returnDocument: 'after' });
  }
  const budget = await getBudgetSummary(req.user.id, period);
  return res.json({ success: true, message: 'Monthly budget saved successfully', data: { budget } });
}
````

## backend/controllers/dashboardController.js
````
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { roundMoney, sumAmount, roundedTotal } from '../utils/finance.js';

export async function getDashboardSummary(req, res) {
  const user = new mongoose.Types.ObjectId(req.user.id);
  const [totals, recentTransactions, expensesByCategory, budget] = await Promise.all([
    Transaction.aggregate([
      { $match: { user } },
      { $group: { _id: '$type', total: sumAmount } },
      { $project: { _id: 0, type: '$_id', total: roundedTotal } },
    ]),
    Transaction.find({ user }).sort({ date: -1, _id: -1 }).limit(5).lean(),
    Transaction.aggregate([
      { $match: { user, type: 'expense' } },
      { $group: { _id: '$category', total: sumAmount } },
      { $project: { _id: 0, category: '$_id', total: roundedTotal } },
      { $sort: { total: -1, category: 1 } },
    ]),
    getBudgetSummary(user),
  ]);
  const totalIncome = totals.find(item => item.type === 'income')?.total ?? 0;
  const totalExpenses = totals.find(item => item.type === 'expense')?.total ?? 0;
  return res.json({ success: true, message: 'Dashboard summary retrieved', data: {
    totalIncome, totalExpenses, balance: roundMoney(totalIncome - totalExpenses),
    recentTransactions, expensesByCategory, budget,
  } });
}
````

## backend/routes/budgetRoutes.js
````
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getCurrentBudget, setCurrentBudget } from '../controllers/budgetController.js';

const router = Router();
router.use(protect);
router.route('/current').get(getCurrentBudget).put(setCurrentBudget);
export default router;
````

## backend/routes/dashboardRoutes.js
````
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getDashboardSummary } from '../controllers/dashboardController.js';

const router = Router();
router.get('/summary', protect, getDashboardSummary);
export default router;
````

## backend/services/budgetService.js
````
import mongoose from 'mongoose';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { currentMonth, roundMoney, sumAmount, roundedTotal } from '../utils/finance.js';

export async function getBudgetSummary(userId, period = currentMonth()) {
  const user = new mongoose.Types.ObjectId(String(userId));
  const [budget, totals] = await Promise.all([
    Budget.findOne({ user, month: period.month, year: period.year }).lean(),
    Transaction.aggregate([
      { $match: { user, type: 'expense', date: { $gte: period.start, $lt: period.end } } },
      { $group: { _id: null, total: sumAmount } },
      { $project: { _id: 0, total: roundedTotal } },
    ]),
  ]);
  const monthlyExpenses = totals[0]?.total ?? 0;
  const amount = budget ? roundMoney(budget.amount) : null;
  return {
    isSet: Boolean(budget), month: period.month, year: period.year, amount, monthlyExpenses,
    remaining: budget ? roundMoney(amount - monthlyExpenses) : null,
    overspent: budget ? roundMoney(Math.max(0, monthlyExpenses - amount)) : 0,
    progressPercentage: budget ? (amount > 0 ? roundMoney(monthlyExpenses / amount * 100) : 0) : null,
  };
}
````

## backend/utils/finance.js
````
export function currentMonth(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return { year, month, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export function roundMoney(value) {
  return Number(value.toFixed(2));
}

// Sum as decimal in MongoDB before converting to JSON numbers.
export const sumAmount = { $sum: { $toDecimal: '$amount' } };
export const roundedTotal = { $toDouble: { $round: ['$total', 2] } };
````

## backend/tests/budgets.test.js
````
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { currentMonth } from '../utils/finance.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { validateJwtSecret } from '../utils/jwt.js';

dotenv.config({ quiet: true });
validateJwtSecret();
const dbName = `expense_tracker_budget_test_${randomUUID().replaceAll('-', '')}`;
let server;
let checks = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Budget.init(), Transaction.init()]);
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method, path, expected, token, body) {
    const response = await fetch(base + path, { method, signal: AbortSignal.timeout(15000), headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    assert.equal(result.success, expected < 400);
    if (expected >= 400) assert.deepEqual(Object.keys(result).sort(), ['message', 'success']);
    checks++;
    return result.data;
  }
  const register = email => request('POST', '/api/auth/register', 201, null, { name: 'Budget Tester', email, password: 'TestPassword123!' });
  const first = await register('first@example.com');
  const second = await register('second@example.com');
  const third = await register('third@example.com');
  const budgetPath = '/api/budgets/current';
  const dashboardPath = '/api/dashboard/summary';
  for (const [method, path] of [['GET', budgetPath], ['PUT', budgetPath], ['GET', dashboardPath]]) {
    await request(method, path, 401, null, method === 'PUT' ? { amount: 1 } : undefined);
    await request(method, path, 401, 'invalid', method === 'PUT' ? { amount: 1 } : undefined);
  }
  const empty = await request('GET', dashboardPath, 200, first.token);
  assert.equal(empty.totalIncome, 0); assert.equal(empty.totalExpenses, 0); assert.equal(empty.balance, 0);
  assert.deepEqual(empty.recentTransactions, []); assert.deepEqual(empty.expensesByCategory, []);
  assert.equal(empty.budget.isSet, false); assert.equal(empty.budget.amount, null); assert.equal(empty.budget.remaining, null); assert.equal(empty.budget.progressPercentage, null);
  for (const body of [null, [], {}, { amount: -1 }, { amount: '100' }, { amount: null }, { amount: true }, { amount: 1, user: second.user.id }, { amount: 1, month: 1 }, { amount: { $gt: 0 } }]) await request('PUT', budgetPath, 400, first.token, body);
  const zero = (await request('PUT', budgetPath, 200, first.token, { amount: 0 })).budget;
  assert.equal(zero.isSet, true); assert.equal(zero.progressPercentage, 0); assert.equal(zero.remaining, 0);
  const period = currentMonth();
  const date = period.start.toISOString().slice(0, 10);
  for (const [type, amount, category] of [['income', 80000, 'Salary'], ['expense', 10000, 'Food'], ['expense', 20000, 'Travel']]) {
    await request('POST', '/api/transactions', 201, first.token, { type, amount, category, date });
  }
  const beforeStart = new Date(period.start.getTime() - 86400000);
  await Transaction.create([
    { user: first.user.id, type: 'expense', amount: 7000, category: 'Food', date: beforeStart },
    { user: first.user.id, type: 'expense', amount: 3000, category: 'Travel', date: period.end },
    { user: second.user.id, type: 'expense', amount: 999999, category: 'Private', date: period.start },
  ]);
  const zeroWithSpending = (await request('GET', budgetPath, 200, first.token)).budget;
  assert.equal(zeroWithSpending.monthlyExpenses, 30000); assert.equal(zeroWithSpending.progressPercentage, 0); assert.equal(zeroWithSpending.overspent, 30000);
  const normal = (await request('PUT', budgetPath, 200, first.token, { amount: 50000 })).budget;
  assert.equal(normal.monthlyExpenses, 30000); assert.equal(normal.remaining, 20000); assert.equal(normal.progressPercentage, 60);
  const overspent = (await request('PUT', budgetPath, 200, first.token, { amount: 25000 })).budget;
  assert.equal(overspent.remaining, -5000); assert.equal(overspent.overspent, 5000); assert.equal(overspent.progressPercentage, 120);
  const dashboard = await request('GET', dashboardPath, 200, first.token);
  assert.equal(dashboard.totalIncome, 80000); assert.equal(dashboard.totalExpenses, 40000); assert.equal(dashboard.balance, 40000);
  assert.deepEqual(dashboard.budget, overspent);
  assert.deepEqual(dashboard.expensesByCategory, [{ category: 'Travel', total: 23000 }, { category: 'Food', total: 17000 }]);
  assert.equal(dashboard.recentTransactions.length, 5);
  assert.equal(dashboard.recentTransactions[0].date, period.end.toISOString());
  assert.ok(dashboard.recentTransactions.every(item => item.user === first.user.id));
  const extraBody = { type: 'expense', amount: 10, category: 'Refresh', date };
  const extra = await request('POST', '/api/transactions', 201, first.token, extraBody);
  const extraPath = `/api/transactions/${extra.transaction._id}`;
  const refreshed = await request('GET', dashboardPath, 200, first.token);
  assert.equal(refreshed.totalExpenses, 40010); assert.equal(refreshed.budget.monthlyExpenses, 30010);
  assert.equal(refreshed.recentTransactions.length, 5);
  await request('PUT', extraPath, 200, first.token, { ...extraBody, amount: 20 });
  const edited = await request('GET', dashboardPath, 200, first.token);
  assert.equal(edited.totalExpenses, 40020); assert.equal(edited.budget.monthlyExpenses, 30020);
  await request('DELETE', extraPath, 200, first.token);
  assert.equal((await request('GET', dashboardPath, 200, first.token)).totalExpenses, 40000);
  const other = await request('GET', dashboardPath, 200, second.token);
  assert.equal(other.totalExpenses, 999999); assert.equal(other.balance, -999999); assert.equal(other.budget.isSet, false);
  await request('PUT', budgetPath, 200, second.token, { amount: 100 });
  assert.equal((await request('GET', budgetPath, 200, first.token)).budget.amount, 25000);
  await Promise.all([100, 200, 300].map(amount => request('PUT', budgetPath, 200, third.token, { amount })));
  assert.equal(await Budget.countDocuments({ user: third.user.id, month: period.month, year: period.year }), 1);
  await assert.rejects(Budget.create({ user: first.user.id, month: period.month, year: period.year, amount: 1 }), error => error.code === 11000);
  await assert.rejects(Budget.create({ user: first.user.id, month: 13, year: 2026, amount: -1 }), { name: 'ValidationError' });
  await Transaction.create([
    { user: third.user.id, type: 'expense', amount: 0.1, category: 'Decimals', date: period.start },
    { user: third.user.id, type: 'expense', amount: 0.2, category: 'Decimals', date: period.start },
  ]);
  assert.equal((await request('GET', dashboardPath, 200, third.token)).totalExpenses, 0.3);
  const december = currentMonth(new Date('2026-12-31T23:59:59.999Z'));
  assert.equal(december.end.toISOString(), '2027-01-01T00:00:00.000Z');
  const leap = currentMonth(new Date('2024-02-29T12:00:00Z'));
  assert.equal(leap.end.toISOString(), '2024-03-01T00:00:00.000Z');
  const boundaryUser = new mongoose.Types.ObjectId();
  await Transaction.create([
    { user: boundaryUser, type: 'expense', amount: 5, category: 'Boundary', date: december.start },
    { user: boundaryUser, type: 'expense', amount: 10, category: 'Boundary', date: december.end },
  ]);
  assert.equal((await getBudgetSummary(boundaryUser, december)).monthlyExpenses, 5);
  console.info(`PASS: ${checks} budget/dashboard API checks plus unique index, decimal sums, month boundaries, zero budgets, overspending, and user isolation.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  } finally { await mongoose.disconnect(); }
}
````

## backend/app.js
````
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL }));
  app.use(express.json({ limit: '10kb' }));
  app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Expense & Budget Tracker API is running' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
````

## backend/server.js
````
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { validateJwtSecret } from './utils/jwt.js';
import User from './models/User.js';
import Budget from './models/Budget.js';

dotenv.config({ quiet: true });

async function startServer() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set PORT to a valid port number in backend/.env.');
  }
  if (!process.env.CLIENT_URL) {
    throw new Error('Set CLIENT_URL in backend/.env.');
  }

  validateJwtSecret();
  await connectDatabase();
  await Promise.all([User.init(), Budget.init()]);
  const server = createApp().listen(port, () => {
    console.info(`Expense & Budget Tracker API listening on port ${port}.`);
  });

  server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? 'Backend port is already in use. Change PORT or stop the conflicting server.' : 'HTTP server failed to start.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });

  async function shutdown() {
    server.close(async () => {
      await mongoose.disconnect();
      process.exitCode = 0;
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch(async (error) => {
  console.error('Backend startup failed. Check environment settings, MongoDB availability, and database index configuration.');
  await mongoose.disconnect();
  process.exitCode = 1;
});
````

## backend/package.json
````
{
  "name": "expense-tracker-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js",
    "test": "node tests/auth.test.js && node tests/transactions.test.js && node tests/budgets.test.js",
    "test:transactions": "node tests/transactions.test.js",
    "test:budgets": "node tests/budgets.test.js"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cors": "^2.8.6",
    "dotenv": "^18.0.5",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.10.4"
  }
}
````

## README.md
````
# Expense & Budget Tracker

## Project Overview

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–4: Foundation, Authentication, Transaction APIs, and Budget/Dashboard Backend**.

## Features

Implemented: responsive starting screen, React Router navigation, live API health check with loading/error/retry states, Express API, MongoDB connection configuration, and backend registration/login with JWT-protected user lookup, and user-owned income/expense APIs with search and filters, monthly budgets, and dashboard summary calculations.

Planned for Parts 5–9: frontend authentication, transaction and budget pages, dashboard and charts, validation, pagination, CSV export, and submission documentation.

## Technologies Used

JavaScript, React, Vite, Tailwind CSS, React Router, Node.js, Express, MongoDB, and Mongoose. bcryptjs hashes passwords and jsonwebtoken signs and verifies backend authentication tokens. Frontend authentication arrives in Part 5.

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

Open http://localhost:5173. The screen should be styled with a pale background, green accents, and a responsive foundation card. The backend health message appears after the live request completes.

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

Confirm the startup log reports MongoDB connected. Check the page at desktop, tablet, and 320px widths; the card should stack and text should fit. Open `/missing` and use Return home to verify routing. Stop the backend, click Check connection, confirm the error state, then restart and retry. Backend authentication is available; the frontend remains the Part 1 starting screen. Transaction APIs are available; financial pages come later.

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

Parts 1–4 implemented (4/9). Next: Part 5 frontend authentication, protected routes, and application layout. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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

Expected: registration succeeds, login returns a token, authenticated lookup returns only safe user fields, and the final unauthenticated call returns 401. Keep tokens private. A repeated registration email returns 409. If startup fails, check that JWT_SECRET is set, MongoDB is reachable, and the user email index can be created. No login page is expected until Part 5.

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
````
