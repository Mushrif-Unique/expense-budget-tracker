export function validateTransactionForm(values) {
  const errors = {};
  if (!['income', 'expense'].includes(values.type)) errors.type = 'Choose income or expense.';
  if (!values.amount.trim() || !Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) errors.amount = 'Enter an amount greater than zero.';
  if (!values.category.trim() || values.category.trim().length > 100) errors.category = 'Enter a category of 1–100 characters.';
  if (values.description.trim().length > 1000) errors.description = 'Use at most 1000 characters.';
  const date = new Date(`${values.date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.date) errors.date = 'Enter a valid calendar date.';
  return errors;
}
export const formatAmount = amount => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(amount);
export const formatDate = date => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date));
export function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
