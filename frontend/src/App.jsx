import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={
        <main className="min-h-screen bg-stone-50 p-8 text-slate-900">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <Link to="/" className="mt-6 inline-block text-emerald-800 underline">Return home</Link>
        </main>
      } />
    </Routes>
  );
}
