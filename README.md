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
