import { formatAmount } from '../utils/transactions.js';

export default function ExpenseChart({ categories }) {
  const maximum = categories.reduce((maximum, item) => Math.max(maximum, item.total), 0);
  const total = categories.reduce((sum, item) => sum + item.total, 0);
  const colors = ['#315c38', '#8ead6f', '#c6d9ac', '#d9b781', '#9aaea0', '#6d8062'];
  let offset = 0;
  const segments = categories.map((item, index) => {
    const start = offset;
    offset += total > 0 ? item.total / total * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  });
  return <figure aria-label="Expenses by category" className="panel p-6 sm:p-8">
    <figcaption className="text-lg font-semibold">Expenses by category</figcaption><p className="mt-1 text-xs text-slate-500">All recorded expenses · LKR</p>
    {maximum === 0 ? <p className="py-10 text-center text-sm text-slate-500">No expense data yet. Add an expense to see your chart.</p> : <>
      <div aria-hidden="true" className="relative mx-auto my-7 h-44 w-44 rounded-full p-5" style={{ background: `conic-gradient(${segments.join(',')})` }}><div className="flex h-full flex-col items-center justify-center rounded-full bg-white"><span className="text-3xl font-semibold tracking-tight">{categories.length}</span><span className="mt-1 text-xs text-slate-500">{categories.length === 1 ? 'category' : 'categories'}</span></div></div>
      <ul className="space-y-4">{categories.map((item, index) => <li key={item.category}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]"><span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }} />{item.category}</span><span className="break-all tabular-nums text-slate-600">{formatAmount(item.total)}</span></div><div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full" style={{ background: colors[index % colors.length], width: `${Math.max(0, Math.min(100, item.total / maximum * 100))}%` }} /></div></li>)}</ul>
    </>}
  </figure>;
}
