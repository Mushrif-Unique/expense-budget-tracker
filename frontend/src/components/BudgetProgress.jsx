import { formatAmount } from '../utils/transactions.js';

export function budgetMonth(budget) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(budget.year, budget.month - 1, 1)));
}

export default function BudgetProgress({ budget }) {
  const percentage = budget.progressPercentage ?? 0;
  const visual = budget.amount === 0 && budget.overspent > 0 ? 100 : Math.min(100, Math.max(0, percentage));
  return <section aria-label="Budget progress" className="panel p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Monthly spending</h2><span className="text-sm text-slate-500">{budgetMonth(budget)}</span></div>
    <p className="mt-6 break-all text-3xl font-semibold tabular-nums">{formatAmount(budget.monthlyExpenses)}</p>
    <p className="mt-2 text-sm text-slate-500">{budget.isSet ? `of ${formatAmount(budget.amount)} budget` : 'No budget set for this month.'}</p>
    {budget.isSet && <>
      <div role="progressbar" aria-label="Monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={visual} aria-valuetext={budget.amount === 0 ? 'Zero budget; percentage not applicable' : `${percentage}% used`} className="mt-6 h-3 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full ${budget.overspent > 0 ? 'bg-red-600' : 'bg-emerald-700'}`} style={{ width: `${visual}%` }} /></div>
      <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm"><span className="text-slate-600">{budget.amount === 0 ? 'Zero budget — no percentage to calculate' : `${percentage}% used`}</span><strong className={`break-words ${budget.overspent > 0 ? 'text-red-700' : 'text-emerald-800'}`}>{budget.overspent > 0 ? `Overspent by ${formatAmount(budget.overspent)}` : `${formatAmount(budget.remaining)} remaining`}</strong></div>
    </>}
    <p className="mt-5 text-xs leading-relaxed text-slate-500">Expenses dated in this UTC calendar month. Income does not count toward spending.</p>
  </section>;
}
