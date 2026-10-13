import { useAuth } from '../context/AuthContext.jsx';

export default function WorkspacePage({ section }) {
  const { user } = useAuth();
  const details = {
    dashboard: ['Your personal workspace', `Welcome, ${user.name}.`, 'You are signed in securely. Your financial overview and charts are coming soon.'],
    budget: ['Plan your month', 'Monthly budget', 'Budget planning is coming soon. This will be your space to track monthly spending and progress.'],
  };
  const [eyebrow, title, message] = details[section];
  return <><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">{eyebrow}</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><section className="mt-8 max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"><p className="leading-relaxed text-slate-600">{message}</p>{section === 'dashboard' && <div className="mt-6 border-t border-stone-100 pt-6"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">Signed in as</p><p className="mt-2 break-all font-medium">{user.email}</p></div>}</section></>;
}
