import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import ProtectedRoute, { SessionState } from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BudgetPage from './pages/BudgetPage.jsx';
import TransactionsPage from './pages/TransactionsPage.jsx';

function HomeRedirect() {
  const { status } = useAuth();
  if (status === 'loading' || status === 'error') return <SessionState />;
  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/budget" element={<BudgetPage />} />
    </Route></Route>
    <Route path="*" element={<main className="min-h-screen bg-stone-50 p-8"><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="mt-6 inline-block text-emerald-800 underline">Return home</Link></main>} />
  </Routes></AuthProvider>;
}
