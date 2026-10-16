import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import useApiData from '../hooks/useApiData.js';
import ApiState from '../components/ApiState.jsx';
import BudgetProgress, { budgetMonth } from '../components/BudgetProgress.jsx';

export default function BudgetPage() {
  const { request } = useAuth();
  const { data, loading, error, refresh } = useApiData('/budgets/current');
  const [budget, setBudget] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (data) { setBudget(data.budget); setAmount(data.budget.isSet ? String(data.budget.amount) : ''); } }, [data]);
  async function save(event) {
    event.preventDefault(); setNotice(''); setSaveError('');
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setSaveError('Enter a budget amount of zero or more.'); document.getElementById('budget-amount')?.focus(); return; }
    setBusy(true);
    try {
      const result = await request('/budgets/current', { method: 'PUT', body: { amount: Number(amount) } });
      setBudget(result.data.budget); setAmount(String(result.data.budget.amount)); setNotice('Monthly budget saved.');
    } catch (failure) { setSaveError(failure.message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Plan your month</p><h1 className="page-title">Monthly budget</h1><p className="mt-3 text-slate-500">Set a spending limit that works for you.</p></div><button disabled={loading || busy} className="button-secondary" onClick={() => { setNotice(''); setSaveError(''); refresh(); }}>Refresh budget</button></div>
    {loading || error || !budget ? <ApiState loading={loading || (!error && !budget)} error={error} onRetry={refresh} /> : <div className="mt-8 grid items-start gap-6 xl:grid-cols-2"><BudgetProgress budget={budget} /><section className="panel p-6 sm:p-8"><h2 className="text-lg font-semibold">{budget.isSet ? 'Update your budget' : 'Set your budget'}</h2><p className="mt-2 text-sm text-slate-500">{budgetMonth(budget)} · LKR</p><form onSubmit={save} noValidate aria-busy={busy} className="mt-6"><label htmlFor="budget-amount" className="mb-2 block text-sm font-medium">Budget amount (LKR)</label><input id="budget-amount" type="number" step="any" min="0" inputMode="decimal" required disabled={busy} value={amount} onChange={event => setAmount(event.target.value)} className="form-input" aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'budget-error' : 'budget-help'} /><p id="budget-help" className="mt-2 text-xs text-slate-500">Zero is allowed. Your budget applies to this month only.</p>{saveError && <p id="budget-error" role="alert" className="mt-4 text-sm text-red-700">{saveError}</p>}{notice && <p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}<button disabled={busy} className="button-primary mt-6 w-full">{busy ? 'Saving…' : 'Save budget'}</button></form></section></div>}
  </>;
}
