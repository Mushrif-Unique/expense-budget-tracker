import { formatAmount } from '../utils/transactions.js';

export default function ExpenseChart({ categories }) {
  const maximum = categories.reduce((maximum, item) => Math.max(maximum, item.total), 0);
  return <figure aria-label="Expenses by category" className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
    <figcaption className="text-lg font-semibold">Expenses by category</figcaption><p className="mt-1 text-xs text-slate-500">All recorded expenses · LKR</p>
    {maximum === 0 ? <p className="py-10 text-center text-sm text-slate-500">No expense data yet. Add an expense to see your chart.</p> : <ul className="mt-6 space-y-5">{categories.map(item => <li key={item.category}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{item.category}</span><span className="break-all tabular-nums text-slate-600">{formatAmount(item.total)}</span></div><div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.max(0, Math.min(100, item.total / maximum * 100))}%` }} /></div></li>)}</ul>}
  </figure>;
}
