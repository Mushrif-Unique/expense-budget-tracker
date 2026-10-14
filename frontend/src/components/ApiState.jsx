export default function ApiState({ loading, error, onRetry }) {
  if (loading) return <p role="status" className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-slate-600">Loading your finances…</p>;
  return <div className="mt-8 rounded-2xl border border-red-200 bg-white p-6"><p role="alert" className="text-red-700">{error}</p><button className="button-secondary mt-4" onClick={onRetry}>Try again</button></div>;
}
