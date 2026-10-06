# Part 1 — Complete source
Complete authored configuration and source files for Part 1. Paths are relative to the project root. Generated package-lock.json files are provided alongside each package.json. Empty .gitkeep files preserve the folders listed in README.md. Local .env files initially match their examples; they are deliberately excluded from this document and Git.

## .gitignore
```
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
Thumbs.db
.local/
```

## backend/package.json
```
{
  "name": "expense-tracker-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js"
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
```

## backend/.env.example
```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/expense_budget_tracker
JWT_SECRET=
CLIENT_URL=http://localhost:5173
```

## backend/config/db.js
```
import mongoose from 'mongoose';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in backend/.env.');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.info('MongoDB connected.');
  } catch {
    throw new Error('MongoDB connection failed. Check MONGODB_URI and database availability.');
  }
}
```

## backend/app.js
```
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Expense & Budget Tracker API is running',
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
    const message = status === 400 ? 'Invalid JSON request body' :
      status === 413 ? 'Request body is too large' : 'Internal server error';
    res.status(status).json({ success: false, message });
  });

  return app;
}
```

## backend/server.js
```
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';

dotenv.config({ quiet: true });

async function startServer() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set PORT to a valid port number in backend/.env.');
  }
  if (!process.env.CLIENT_URL) {
    throw new Error('Set CLIENT_URL in backend/.env.');
  }

  await connectDatabase();
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

startServer().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

## frontend/package.json
```
{
  "name": "expense-tracker-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node node_modules/vite/bin/vite.js",
    "build": "node node_modules/vite/bin/vite.js build",
    "preview": "node node_modules/vite/bin/vite.js preview"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router-dom": "^7.18.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^5.2.0",
    "tailwindcss": "^4.3.3",
    "vite": "^7.3.6"
  }
}
```

## frontend/.env.example
```
VITE_API_URL=http://localhost:5000/api
```

## frontend/index.html
```
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#064e3b" />
    <meta name="description" content="Personal income, expenses, and monthly budgets in one place." />
    <title>Expense & Budget Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## frontend/vite.config.js
```
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
```

## frontend/src/main.jsx
```
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

## frontend/src/App.jsx
```
import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={
        <main className="min-h-screen bg-stone-50 p-8 text-slate-900">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <Link to="/" className="mt-6 inline-block text-emerald-800 underline">Return home</Link>
        </main>
      } />
    </Routes>
  );
}
```

## frontend/src/index.css
```
@import "tailwindcss";

@layer base {
  body {
    margin: 0;
    min-width: 320px;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }
  button:not(:disabled), a {
    cursor: pointer;
  }
}
```

## frontend/src/services/api.js
```
export async function getHealth(signal) {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('Set VITE_API_URL in frontend/.env and restart Vite.');
  }

  const response = await fetch(`${baseUrl}/health`, { signal });
  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new Error(result.message || 'The API health check failed.');
  }
  return result;
}
```

## frontend/src/pages/HomePage.jsx
```
import { useEffect, useState } from 'react';
import { getHealth } from '../services/api.js';

export default function HomePage() {
  const [attempt, setAttempt] = useState(0);
  const [health, setHealth] = useState({ status: 'loading', message: 'Checking API connection…' });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setHealth({ status: 'loading', message: 'Checking API connection…' });

    getHealth(controller.signal)
      .then((result) => {
        if (active) setHealth({ status: 'success', message: result.message });
      })
      .catch(() => {
        if (active) setHealth({
          status: 'error',
          message: 'Cannot reach the API. Check the backend and frontend environment settings, then retry.',
        });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-5">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-900 font-bold text-white">E</span>
          <span className="font-semibold tracking-tight">Expense & Budget Tracker</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Personal finance, made clear</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">A fresh start for your finances.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">The foundation of your Expense & Budget Tracker is ready. A simple place to manage income, expenses, and monthly budgets is taking shape.</p>
        <section aria-labelledby="foundation-title" className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-5 sm:px-8">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Part 01 / 08</p>
            <h2 id="foundation-title" className="mt-2 text-xl font-semibold">Project foundation</h2>
          </div>
          <div className="grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
            <div>
              <h3 className="font-semibold">Frontend ready</h3>
              <p className="mt-2 leading-relaxed text-slate-600">React, Vite, Tailwind CSS, and React Router are configured.</p>
            </div>
            <div>
              <h3 className="font-semibold">Backend connection</h3>
              <p role="status" aria-live="polite" className={`mt-2 break-words leading-relaxed ${health.status === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{health.message}</p>
              <button type="button" disabled={health.status === 'loading'} onClick={() => setAttempt((value) => value + 1)} className="mt-4 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60">
                {health.status === 'loading' ? 'Checking…' : 'Check connection'}
              </button>
            </div>
          </div>
        </section>
        <p className="mt-6 text-sm text-slate-500">Next: secure registration and login.</p>
      </main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-sm text-slate-500">Built for a clearer view of everyday spending.</footer>
    </div>
  );
}
```

