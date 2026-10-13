import { useState } from 'react';
import Modal from './Modal.jsx';
import { todayDate, validateTransactionForm } from '../utils/transactions.js';

export default function TransactionForm({ transaction, onSave, onClose }) {
  const [values, setValues] = useState({ type: transaction?.type || 'expense', amount: transaction ? String(transaction.amount) : '', category: transaction?.category || '', description: transaction?.description || '', date: transaction?.date.slice(0, 10) || todayDate() });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const props = field => ({ id: `transaction-${field}`, name: field, value: values[field], disabled: busy, onChange: event => setValues({ ...values, [field]: event.target.value }), 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `${field}-error` : undefined, className: 'form-input' });
  async function submit(event) {
    event.preventDefault();
    const next = validateTransactionForm(values);
    setErrors(next); setMessage('');
    if (Object.keys(next).length) { document.getElementById(`transaction-${Object.keys(next)[0]}`)?.focus(); return; }
    setBusy(true);
    try { await onSave({ ...values, amount: Number(values.amount), category: values.category.trim(), description: values.description.trim() }); }
    catch (error) { setMessage(error.message); setBusy(false); }
  }
  return <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} busy={busy} onClose={onClose}>
    <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy}>
      {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
      {['type', 'amount', 'category', 'description', 'date'].map(field => <div key={field}>
        <label htmlFor={`transaction-${field}`} className="mb-2 block text-sm font-medium">{({ type: 'Type', amount: 'Amount (LKR)', category: 'Category', description: 'Description (optional)', date: 'Date' })[field]}</label>
        {field === 'type' ? <select {...props(field)}><option value="expense">Expense</option><option value="income">Income</option></select> : field === 'description' ? <textarea {...props(field)} rows={3} maxLength={1000} /> : <input {...props(field)} type={field === 'amount' ? 'number' : field === 'date' ? 'date' : 'text'} step={field === 'amount' ? 'any' : undefined} inputMode={field === 'amount' ? 'decimal' : undefined} required maxLength={field === 'category' ? 100 : undefined} />}
        {errors[field] && <p id={`${field}-error`} className="mt-1 text-sm text-red-700">{errors[field]}</p>}
      </div>)}
      <div className="flex flex-wrap justify-end gap-3 pt-3"><button type="button" disabled={busy} onClick={onClose} className="button-secondary">Cancel</button><button disabled={busy} className="button-primary">{busy ? 'Saving…' : 'Save transaction'}</button></div>
    </form>
  </Modal>;
}
