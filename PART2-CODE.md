# Part 2 of 9 — Complete source
Complete new and updated files for backend authentication. Local backend/.env contains a generated private JWT secret and is deliberately excluded. No frontend source was changed. Run and verification commands are in the README below.

## backend/models/User.js
````
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, required: true, select: false },
}, {
  timestamps: true,
  toJSON: { transform(doc, result) { delete result.password; delete result.__v; return result; } },
});

export default mongoose.model('User', userSchema);
````

## backend/controllers/authController.js
````
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validateCredentials } from '../utils/validation.js';

export function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export async function register(req, res) {
  const error = validateCredentials(req.body, true);
  if (error) return res.status(400).json({ success: false, message: error });
  const email = req.body.email.trim().toLowerCase();
  if (await User.exists({ email })) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  const password = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ name: req.body.name.trim(), email, password });
  return res.status(201).json({
    success: true, message: 'Registration successful',
    data: { user: safeUser(user), token: generateToken(user.id) },
  });
}

export async function login(req, res) {
  const error = validateCredentials(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  return res.json({
    success: true, message: 'Login successful',
    data: { user: safeUser(user), token: generateToken(user.id) },
  });
}

export function getMe(req, res) {
  return res.json({ success: true, message: 'Authenticated user', data: { user: safeUser(req.user) } });
}
````

## backend/routes/authRoutes.js
````
import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
export default router;
````

## backend/middleware/authMiddleware.js
````
import mongoose from 'mongoose';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

export async function protect(req, res, next) {
  const unauthorized = () => res.status(401).json({ success: false, message: 'A valid authentication token is required.' });
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
  if (!match) return unauthorized();
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return unauthorized();
    return next(error);
  }
  if (!payload || typeof payload.sub !== 'string' || !mongoose.isObjectIdOrHexString(payload.sub)) return unauthorized();
  const user = await User.findById(payload.sub);
  if (!user) return unauthorized();
  req.user = user;
  return next();
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
  else if (error.name === 'ValidationError') { status = 400; message = 'Invalid user data'; }
  return res.status(status).json({ success: false, message });
}
````

## backend/utils/jwt.js
````
import jwt from 'jsonwebtoken';

export function validateJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    throw new Error('Set JWT_SECRET to a private random value of at least 32 characters in backend/.env.');
  }
}

export function generateToken(userId) {
  validateJwtSecret();
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(userId), expiresIn: '1d', algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  validateJwtSecret();
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}
````

## backend/utils/validation.js
````
export function validateCredentials(body, registration = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object.';
  if (registration && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) {
    return 'Name is required and must be at most 100 characters.';
  }
  if (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'A valid email address is required.';
  }
  if (typeof body.password !== 'string' || !body.password.length) return 'Password is required.';
  if (Buffer.byteLength(body.password, 'utf8') > 72) return 'Password must be at most 72 UTF-8 bytes.';
  if (registration && body.password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}
````

## backend/app.js
````
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
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
  await User.init();
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
  console.error('Backend startup failed. Check environment settings, MongoDB availability, and user index configuration.');
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
    "test": "node tests/auth.test.js"
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

## backend/tests/auth.test.js
````
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import { validateJwtSecret } from '../utils/jwt.js';

dotenv.config({ quiet: true });
validateJwtSecret();
const dbName = `expense_tracker_auth_test_${randomUUID().replaceAll('-', '')}`;
let server;
let checks = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await User.init();
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, status, body, token) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    assert.equal(result.success, status < 400);
    if (result.data?.user) assert.equal(result.data.user.password, undefined);
    checks++;
    return result;
  }
  // Error messages may mention passwords; only inspect payload fields for leaks below.
  const originalPassword = 'StrongPass123!';
  const account = { name: ' Test User ', email: ' TEST@example.com ', password: originalPassword };
  const registered = await request('/api/auth/register', 201, account);
  assert.equal(registered.data.user.email, 'test@example.com');
  assert.equal(registered.data.user.name, 'Test User');
  const stored = await User.findById(registered.data.user.id).select('+password');
  assert.notEqual(stored.password, originalPassword);
  assert.ok(await bcrypt.compare(originalPassword, stored.password));
  assert.equal((await User.findById(stored.id)).password, undefined);
  assert.equal(stored.toJSON().password, undefined);
  await request('/api/auth/register', 409, account);
  const login = await request('/api/auth/login', 200, { email: account.email, password: originalPassword });
  await request('/api/auth/me', 200, undefined, `Bearer ${login.data.token}`);
  await request('/api/auth/me', 401);
  await request('/api/auth/me', 401, undefined, 'Bearer invalid');
  await request('/api/auth/me', 401, undefined, `Basic ${login.data.token}`);
  for (const token of [
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, expiresIn: -1 }),
    jwt.sign({}, 'different-secret', { subject: stored.id }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, algorithm: 'HS384' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: 'invalid-id' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, notBefore: '1h' }),
  ]) await request('/api/auth/me', 401, undefined, `Bearer ${token}`);
  await request('/api/auth/login', 401, { email: 'absent@example.com', password: originalPassword });
  await request('/api/auth/login', 401, { email: account.email, password: 'wrong-password' });
  for (const body of [{}, [], { ...account, name: '' }, { ...account, email: 'invalid' }, { ...account, email: { $ne: null } }, { ...account, password: 'short' }, { ...account, password: 'é'.repeat(37) }, { ...account, password: 12345678 }]) {
    await request('/api/auth/register', 400, body);
  }
  const parallel = await Promise.all([1, 2].map(() => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...account, email: 'race@example.com' }) })));
  assert.deepEqual(parallel.map(r => r.status).sort(), [201, 409]);
  checks++;
  for (const [body, status] of [['{', 400], [JSON.stringify({ text: 'x'.repeat(11000) }), 413]]) {
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status); checks++;
  }
  await request('/api/health', 200);
  await request('/api/missing', 404);
  await User.deleteOne({ _id: stored.id });
  await request('/api/auth/me', 401, undefined, `Bearer ${login.data.token}`);
  console.info(`PASS: ${checks} API checks, password hashing, normalized identity, unique index, and safe serialization.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
````

## README.md
````
# Expense & Budget Tracker

## Project Overview

A university individual assignment for managing personal income, expenses, and monthly budgets. Development is split into exactly nine parts. This checkout implements **Parts 1 and 2: Project Foundation and Backend Authentication**.

## Features

Implemented: responsive starting screen, React Router navigation, live API health check with loading/error/retry states, Express API, MongoDB connection configuration, and backend registration/login with JWT-protected user lookup.

Planned for Parts 3–9: frontend authentication, transactions, monthly budgets, dashboard and charts, validation, pagination, CSV export, and submission documentation.

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

Empty folders contain `.gitkeep` files so Git preserves the intended structure. Part 2 adds the User model; transaction and budget models come later.

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

Confirm the startup log reports MongoDB connected. Check the page at desktop, tablet, and 320px widths; the card should stack and text should fit. Open `/missing` and use Return home to verify routing. Stop the backend, click Check connection, confirm the error state, then restart and retry. Backend authentication is available; the frontend remains the Part 1 starting screen. Financial functionality comes later.

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

Parts 1 and 2 implemented (2/9). Next: Part 3 transaction APIs, search, filters, and ownership protection. Wait for explicit `continue` before beginning the next part. Frontend authentication is Part 5, transaction UI Part 6, dashboard/budget/chart UI Part 7, polish and optional features Part 8, and final submission preparation Part 9.

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
````
