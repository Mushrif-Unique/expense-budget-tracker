import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [['/dashboard', 'Overview'], ['/transactions', 'Transactions'], ['/budget', 'Monthly budget']];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const title = links.find(([path]) => path === location.pathname)?.[1] || 'Your workspace';
  return <div className="min-h-screen bg-stone-50 text-slate-900 md:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <aside className="flex shrink-0 flex-col border-b border-stone-200 bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-3 p-5 md:p-7"><NavLink to="/dashboard" className="flex min-w-0 items-center gap-3 font-semibold"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-900 text-white">E</span><span className="text-sm">Expense &<br />Budget Tracker</span></NavLink><button className="button-secondary md:hidden" aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button></div>
      <nav id="app-navigation" aria-label="Main navigation" className={`${menu ? 'block' : 'hidden'} px-4 pb-5 md:block md:mt-5`}>
        {links.map(([path, label]) => <NavLink key={path} to={path} onClick={() => setMenu(false)} className={({ isActive }) => `mb-2 block rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-stone-100'}`}>{label}</NavLink>)}
      </nav>
      <div className="hidden mt-auto p-7 text-xs leading-relaxed text-slate-500 md:block">Small steps toward<br />a clearer financial picture.</div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-6 py-5 sm:px-10"><p className="text-sm font-medium text-slate-600">{title}</p><div className="flex min-w-0 items-center gap-4"><span className="max-w-40 truncate text-sm font-medium" title={user.name}>{user.name}</span><button onClick={logout} className="button-secondary shrink-0">Log out</button></div></header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-10 sm:px-10"><Outlet /></main>
    </div>
  </div>;
}
