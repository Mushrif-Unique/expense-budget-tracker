const fields = ['type', 'amount', 'category', 'description', 'date'];

export function validateTransaction(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object.';
  if (Object.keys(body).some(key => !fields.includes(key))) return 'Only type, amount, category, description, and date may be supplied.';
  if (!['income', 'expense'].includes(body.type)) return 'Type must be income or expense.';
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) return 'Amount must be a positive finite number.';
  if (typeof body.category !== 'string' || !body.category.trim() || body.category.trim().length > 100) return 'Category is required and must be at most 100 characters.';
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.trim().length > 1000)) return 'Description must be text of at most 1000 characters.';
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return 'Date must be a valid calendar date in YYYY-MM-DD format.';
  const date = new Date(`${body.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) return 'Date must be a valid calendar date in YYYY-MM-DD format.';
  return null;
}

export function transactionFields(body) {
  return { type: body.type, amount: body.amount, category: body.category.trim(), description: body.description?.trim() || '', date: new Date(`${body.date}T00:00:00.000Z`) };
}

export function validateTransactionQuery(query) {
  if (Object.keys(query).some(key => !['search', 'type', 'category'].includes(key))) return 'Supported filters are search, type, and category.';
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string' || value.trim().length > 100) return `${key} must be a single text value of at most 100 characters.`;
  }
  if (query.type !== undefined && !['income', 'expense'].includes(query.type)) return 'Type must be income or expense.';
  return null;
}

export function escapeSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
