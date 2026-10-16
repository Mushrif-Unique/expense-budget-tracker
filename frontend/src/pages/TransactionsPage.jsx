import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import Modal from '../components/Modal.jsx';
import { formatAmount, formatDate } from '../utils/transactions.js';

import { collectFilteredTransactions, downloadTransactionsCsv } from '../utils/csv.js';

const emptyFilters = { search: '', type: '', category: '' };
export default function TransactionsPage() {
  const { request } = useAuth();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportController = useRef(null);
  useEffect(() => () => exportController.current?.abort(), []);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set('page', String(page)); query.set('limit', '10');
    request(`/transactions?${query}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setTransactions(result.data.transactions); setPagination(result.data.pagination); setPage(result.data.pagination.page); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, revision, request, page]);
  async function save(body) {
    const editing = editor.transaction;
    await request(editing ? `/transactions/${editing._id}` : '/transactions', { method: editing ? 'PUT' : 'POST', body });
    setEditor(null); setNotice(editing ? 'Transaction updated.' : 'Transaction added.'); setRevision(value => value + 1);
  }
  async function remove() {
    setDeleteBusy(true); setDeleteError('');
    try {
      await request(`/transactions/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null); setNotice('Transaction deleted.'); setRevision(value => value + 1);
    } catch (failure) { setDeleteError(failure.message); }
    finally { setDeleteBusy(false); }
  }
  async function exportCsv() {
    if (exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true); setExportError('');
    try {
      const records = await collectFilteredTransactions(request, filters, controller.signal);
      if (!controller.signal.aborted) { downloadTransactionsCsv(records); setNotice(`Exported ${records.length} matching transactions.`); }
    } catch (failure) { if (!controller.signal.aborted) setExportError(failure.message); }
    finally { if (exportController.current === controller) { exportController.current = null; setExporting(false); } }
  }
  function resetExport() {
    exportController.current?.abort(); exportController.current = null; setExporting(false); setExportError('');
  }
  function apply(event) {
    event.preventDefault(); setNotice(''); setPage(1); resetExport();
    setFilters({ search: draft.search.trim(), type: draft.type, category: draft.category.trim() });
  }
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Income & expenses</p><h1 className="page-title">Transactions</h1><p className="mt-3 text-slate-500">Keep track of the money coming in and going out.</p></div><button className="button-primary" onClick={() => { setNotice(''); setEditor({ transaction: null }); }}>Add transaction</button></div>
    {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice} Active filters still apply.</p>}
    <form onSubmit={apply} className="mt-8 grid items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 xl:grid-cols-[2fr_1fr_1fr_auto]">
      <div><label htmlFor="search" className="mb-2 block text-sm font-medium">Search</label><input id="search" className="form-input" placeholder="Description or category" maxLength={100} value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></div>
      <div><label htmlFor="filter-type" className="mb-2 block text-sm font-medium">Filter by type</label><select id="filter-type" className="form-input" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div>
      <div><label htmlFor="filter-category" className="mb-2 block text-sm font-medium">Filter by category</label><input id="filter-category" placeholder="All categories" className="form-input" maxLength={100} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></div>
      <div className="flex flex-wrap gap-2"><button className="button-primary">Apply filters</button><button type="button" className="button-secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setNotice(''); setPage(1); resetExport(); }}>Reset</button></div>
    </form>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Export includes every record matching the applied filters, across all pages.</p><button type="button" disabled={loading || Boolean(error) || pagination.total === 0 || exporting} className="button-secondary" onClick={exportCsv}>{exporting ? 'Exporting…' : 'Export CSV'}</button></div>
    {exportError && <p role="alert" className="mt-3 text-sm text-red-700">{exportError} Use Export CSV to retry.</p>}
    <section aria-label="Transaction history" aria-busy={loading} className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">Transaction history</h2><p className="mt-1 text-xs text-slate-500">Newest transaction dates first · Amounts in LKR</p></div>
      {loading ? <p role="status" className="p-8 text-slate-500">Loading transactions…</p> : error ? <div className="p-6"><p role="alert" className="text-red-700">{error}</p><button className="button-secondary mt-4" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : transactions.length === 0 ? <div className="p-8 text-center"><p className="font-medium">No transactions found.</p><p className="mt-2 text-sm text-slate-500">Add a transaction or adjust your filters.</p></div> : <ul className="divide-y divide-stone-100">{transactions.map(transaction => <li key={transaction._id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center" aria-label={`${transaction.category} transaction`}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>{transaction.type === 'income' ? 'Income' : 'Expense'}</span><span className="min-w-0 max-w-full break-words font-medium [overflow-wrap:anywhere]">{transaction.category}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 [overflow-wrap:anywhere]">{transaction.description || 'No description'}</p><time dateTime={transaction.date.slice(0, 10)} className="mt-2 block text-xs text-slate-500">{formatDate(transaction.date)}</time></div>
        <p className={`break-all font-semibold tabular-nums ${transaction.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}>{transaction.type === 'income' ? '+' : '−'}{formatAmount(transaction.amount)}</p>
        <div className="flex gap-2"><button className="button-secondary" onClick={() => setEditor({ transaction })}>Edit</button><button className="button-secondary text-red-700" onClick={() => { setDeleteError(''); setDeleting(transaction); }}>Delete</button></div>
      </li>)}</ul>}
      {!error && <nav aria-label="Transaction pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 p-5"><p aria-live="polite" className="text-sm text-slate-600">Page {pagination.page} of {Math.max(1, pagination.pages)} · {pagination.total} transactions</p><div className="flex gap-2"><button className="button-secondary" disabled={loading || pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button><button className="button-secondary" disabled={loading || pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></nav>}
    </section>
    {editor && <TransactionForm transaction={editor.transaction} onSave={save} onClose={() => setEditor(null)} />}
    {deleting && <Modal title="Delete transaction?" busy={deleteBusy} onClose={() => setDeleting(null)}><p className="break-words text-slate-600">Delete the {deleting.category} transaction for {formatAmount(deleting.amount)}? This cannot be undone.</p>{deleteError && <p role="alert" className="mt-4 text-red-700">{deleteError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button className="button-secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button><button className="button-primary bg-red-700 hover:bg-red-800" disabled={deleteBusy} onClick={remove}>{deleteBusy ? 'Deleting…' : 'Delete transaction'}</button></div></Modal>}
  </>;
}
