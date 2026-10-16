import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { SessionState } from '../components/ProtectedRoute.jsx';
import Icon from '../components/Icon.jsx';
import { validateAuth } from '../utils/authValidation.js';

export default function AuthPage({ mode }) {
  const register = mode === 'register';
  const { status, authenticate } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const destination = ['/dashboard', '/transactions', '/budget'].includes(location.state?.from) ? location.state.from : '/dashboard';
  if (status === 'loading' || status === 'error') return <SessionState />;
  if (status === 'authenticated') return <Navigate to={destination} replace />;

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateAuth(values, register);
    setErrors(nextErrors); setMessage('');
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setBusy(true);
    try { await authenticate(mode, { ...(register ? { name: values.name.trim() } : {}), email: values.email.trim(), password: values.password }); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-stone-50 text-slate-900 lg:grid lg:grid-cols-2">
    <section className="auth-art relative flex flex-col justify-between bg-emerald-950 px-6 py-8 text-white sm:px-12 lg:min-h-screen lg:p-16">
      <Link to="/" className="flex items-center gap-3 text-sm font-semibold"><span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-200 text-emerald-950"><Icon name="wallet" className="h-6 w-6" /></span>Expense & Budget Tracker</Link>
      <div className="my-10 max-w-lg lg:my-20"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">A little clarity, every day</p><h1 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-.045em] sm:text-6xl">Make room for<br /><span className="text-emerald-200">what matters.</span></h1><p className="mt-5 max-w-sm leading-relaxed text-emerald-100/80">A personal space for your income, spending, and monthly plans.</p></div>
      <p className="hidden text-sm text-emerald-200/70 lg:block">Clarity today. Confidence tomorrow.</p>
    </section>
    <section className="flex items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-md page-enter"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Welcome{register ? '' : ' back'}</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">{register ? 'Create your account' : 'Sign in to your space'}</h2><p className="mt-3 text-slate-500">{register ? 'Start with a few details. Keep everything in one place.' : 'Pick up where you left off.'}</p>
        <form className="mt-8 space-y-5" noValidate onSubmit={submit} aria-busy={busy}>
          {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</p>}
          {(register ? ['name', 'email', 'password'] : ['email', 'password']).map(field => <div key={field}>
            <label htmlFor={field} className="mb-2 block text-sm font-medium">{field === 'name' ? 'Full name' : field === 'email' ? 'Email address' : 'Password'}</label>
            <input id={field} name={field} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} autoComplete={field === 'password' ? (register ? 'new-password' : 'current-password') : field} required disabled={busy} value={values[field]} onChange={event => setValues({ ...values, [field]: event.target.value })} aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `${field}-error` : field === 'password' && register ? 'password-hint' : undefined} className="form-input" />
            {errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{errors[field]}</p>}
            {field === 'password' && register && !errors.password && <p id="password-hint" className="mt-2 text-xs text-slate-500">Use at least 8 characters.</p>}
          </div>)}
          <button type="submit" disabled={busy} className="button-primary w-full">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{register ? 'Already have an account? ' : 'New here? '}<Link className="font-semibold text-emerald-800 underline underline-offset-4" state={location.state} to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </div>
    </section>
  </main>;
}
