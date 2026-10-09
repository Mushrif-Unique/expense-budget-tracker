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
