import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import useApiData from '../hooks/useApiData.js';
import ApiState from '../components/ApiState.jsx';
import BudgetProgress from '../components/BudgetProgress.jsx';
import ExpenseChart from '../components/ExpenseChart.jsx';
import { formatAmount, formatDate } from '../utils/transactions.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useApiData('/dashboard/summary');
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0 max-w-full"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Your financial overview</p><h1 className="mt-3 break-words [overflow-wrap:anywhere] text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {user.name}.</h1><p className="mt-3 text-slate-500">A clearer view of your everyday finances.</p></div><button onClick={refresh} disabled={loading} className="button-secondary">Refresh overview</button></div>
    {loading || error ? <ApiState loading={loading} error={error} onRetry={refresh} /> : <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Total income', data.totalIncome], ['Total expenses', data.totalExpenses], ['Balance', data.balance], ['Monthly budget', data.budget.amount]].map(([label, amount]) => <section key={label} aria-label={label} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-sm text-slate-500">{label}</h2><p className={`mt-3 break-all text-2xl font-semibold tabular-nums ${label === 'Balance' && amount < 0 ? 'text-red-700' : 'text-slate-900'}`}>{amount === null ? 'Not set' : formatAmount(amount)}</p><p className="mt-2 text-xs text-slate-500">{label === 'Monthly budget' ? 'Current UTC month' : 'All recorded transactions'}</p></section>)}</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><div><BudgetProgress budget={data.budget} /><Link to="/budget" className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4">Manage monthly budget</Link></div><ExpenseChart categories={data.expensesByCategory} /></div>
      <section aria-label="Recent transactions" className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-6"><h2 className="text-lg font-semibold">Recent transactions</h2><Link to="/transactions" className="text-sm font-semibold text-emerald-800 underline">View all transactions</Link></div>{data.recentTransactions.length === 0 ? <p className="p-8 text-center text-slate-500">No transactions yet. Add your first income or expense.</p> : <ul className="divide-y divide-stone-100">{data.recentTransactions.map(item => <li key={item._id} className="flex flex-wrap items-center justify-between gap-3 p-6"><div className="min-w-0"><p className="break-words font-medium [overflow-wrap:anywhere]">{item.category}</p><p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">{item.description || (item.type === 'income' ? 'Income' : 'Expense')}</p><time dateTime={item.date.slice(0, 10)} className="mt-1 block text-xs text-slate-500">{formatDate(item.date)}</time></div><span className={`break-all font-semibold tabular-nums ${item.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}>{item.type === 'income' ? '+' : '−'}{formatAmount(item.amount)}</span></li>)}</ul>}</section>
    </>}
  </>;
}
