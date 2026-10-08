# Part 3 of 9 — Complete source
Complete new and updated files for transaction management. Paths are relative to the project root. No environment values or frontend source changes are required. Parts 1 and 2 remain available in their original source handoffs. Verification: 85 transaction API checks and 28 authentication checks passed, backend syntax passed, frontend build passed, actual server startup/health/protected-route checks passed. Test databases are temporary and isolated from application data.

## backend/models/Transaction.js
````
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  amount: { type: Number, required: true, validate: { validator: value => Number.isFinite(value) && value > 0, message: 'Amount must be a positive finite number.' } },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  date: { type: Date, required: true },
}, { timestamps: true });

transactionSchema.index({ user: 1, date: -1, _id: -1 });
export default mongoose.model('Transaction', transactionSchema);
````

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
  const transactions = await Transaction.find(filter).sort({ date: -1, _id: -1 });
  return res.json({ success: true, message: 'Transactions retrieved', data: { transactions } });
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

## backend/routes/transactionRoutes.js
````
import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { listTransactions, createTransaction, getTransaction, updateTransaction, deleteTransaction } from '../controllers/transactionController.js';

const router = Router();
router.use(protect);
router.route('/').get(listTransactions).post(createTransaction);
router.route('/:id').get(getTransaction).put(updateTransaction).delete(deleteTransaction);
export default router;
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
  if (Object.keys(query).some(key => !['search', 'type', 'category'].includes(key))) return 'Supported filters are search, type, and category.';
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string' || value.trim().length > 100) return `${key} must be a single text value of at most 100 characters.`;
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
  console.info(`PASS: ${checks} transaction API checks including CRUD, validation, search/filter combinations, and two-user isolation.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
  }
}
````

## backend/app.js
````
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
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
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
````

## backend/middleware/errorMiddleware.js
````
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let message = 'Internal server error';
  if (error.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON request body'; }
  else if (error.type === 'entity.too.large') { status = 413; message = 'Request body is too large'; }
  else if (error.code === 11000) { status = 409; message = 'An account with this email already exists.'; }
  else if (error.name === 'ValidationError') { status = 400; message = 'Invalid request data'; }
  return res.status(status).json({ success: false, message });
}
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
    "test": "node tests/auth.test.js && node tests/transactions.test.js",
    "test:transactions": "node tests/transactions.test.js"
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

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1–3: Project Foundation, Backend Authentication, and Transaction APIs**.

## Features

Implemented: responsive starting screen, React Router navigation, live API health check with loading/error/retry states, Express API, MongoDB connection configuration, and backend registration/login with JWT-protected user lookup, and user-owned income/expense APIs with search and filters.

Planned for Parts 4–9: frontend authentication and transaction UI, monthly budgets, dashboard and charts, validation, pagination, CSV export, and submission documentation.

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
  config/ controllers/ middleware/ models/ routes/ utils/
  .env.example app.js server.js package.json
.gitignore
README.md
```

Empty folders contain `.gitkeep` files so Git preserves the intended structure. Part 2 adds the User model and Part 3 adds the Transaction model. The Budget model comes in Part 4.

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

Parts 1–3 implemented (3/9). Next: Part 4 monthly budgets and dashboard backend. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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
````
