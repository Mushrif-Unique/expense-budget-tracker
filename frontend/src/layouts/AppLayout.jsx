import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';

const links = [['/dashboard', 'Overview', 'overview'], ['/transactions', 'Transactions', 'transactions'], ['/budget', 'Monthly budget', 'budget']];
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const title = links.find(([path]) => path === location.pathname)?.[1] || 'Your workspace';
  return <div className="min-h-screen bg-stone-50 text-slate-900 md:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <aside className="flex shrink-0 flex-col bg-emerald-950 text-white md:sticky md:top-0 md:h-screen md:w-60 xl:w-64">
      <div className="flex items-center justify-between gap-3 p-5 md:px-7 md:py-9"><NavLink to="/dashboard" className="flex min-w-0 items-center gap-3 font-semibold"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-200 text-emerald-950"><Icon name="wallet" className="h-6 w-6" /></span><span className="text-sm leading-relaxed">Expense &<br /><span className="font-normal text-emerald-100">Budget Tracker</span></span></NavLink><button className="button-secondary md:hidden" aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? 'Close' : 'Menu'}</button></div>
      <nav id="app-navigation" aria-label="Main navigation" className={`${menu ? 'block' : 'hidden'} px-4 pb-5 md:block md:mt-5`}><p className="mb-4 px-4 text-[10px] font-semibold uppercase tracking-[.2em] text-emerald-200/70">Your workspace</p>
        {links.map(([path, label, icon]) => <NavLink key={path} to={path} onClick={() => setMenu(false)} className={({ isActive }) => `nav-item ${isActive ? 'bg-emerald-200 text-emerald-950' : 'text-emerald-100 hover:bg-white/10'}`}><Icon name={icon} />{label}</NavLink>)}
      </nav>
      <div className="mt-auto hidden p-6 md:block"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><span className="mb-4 block h-1 w-7 rounded bg-emerald-200" /><p className="text-sm font-medium text-emerald-100">Make room for what matters.</p><p className="mt-2 text-xs leading-relaxed text-emerald-100/70">A little clarity for your everyday finances.</p></div><p className="mt-5 text-[10px] uppercase tracking-widest text-emerald-100/50">Personal finance, thoughtfully.</p></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white/80 px-6 py-5 sm:px-9"><div className="flex items-center gap-2 text-sm"><span className="hidden text-slate-500 sm:inline">Workspace</span><span aria-hidden="true" className="hidden text-stone-300 sm:inline">/</span><span className="font-medium">{title}</span></div><div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-stone-50 text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span><span className="max-w-32 truncate text-sm font-medium" title={user.name}>{user.name}</span><button onClick={logout} className="button-secondary flex shrink-0 items-center gap-2"><Icon name="logout" className="h-4 w-4" /><span>Log out</span></button></div></header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 sm:px-9 sm:py-10"><div key={location.pathname} className="page-enter"><Outlet /></div></main>
    </div>
  </div>;
}
