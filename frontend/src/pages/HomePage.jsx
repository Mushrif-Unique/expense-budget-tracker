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
