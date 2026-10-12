import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function SessionState() {
  const { status, error, retry, logout } = useAuth();
  return <main className="grid min-h-screen place-items-center bg-stone-50 px-6">
    <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8" aria-live="polite">
      <h1 className="text-xl font-semibold">{status === 'error' ? 'Unable to restore your session' : 'Checking your session…'}</h1>
      {status === 'error' && <><p role="alert" className="mt-3 text-slate-600">{error}</p><div className="mt-6 flex flex-wrap gap-3"><button className="button-primary" onClick={retry}>Try again</button><button className="button-secondary" onClick={logout}>Back to sign in</button></div></>}
    </section>
  </main>;
}

export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading' || status === 'error') return <SessionState />;
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}
