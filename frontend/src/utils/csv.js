function csvCell(value, text = false) {
  let content = String(value ?? '');
  // Spreadsheet applications may execute formulas even in quoted cells.
  if (text && (/^\s*[=+@-]/u.test(content) || /^[\t\r\n]/.test(content))) content = "'" + content;
  return '"' + content.replaceAll('"', '""') + '"';
}

export function transactionsCsv(transactions) {
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount'].map(value => csvCell(value)).join(',');
  const rows = transactions.map(item => [csvCell(item.date.slice(0, 10)), csvCell(item.type), csvCell(item.category, true), csvCell(item.description, true), csvCell(item.amount)].join(','));
  return '\uFEFF' + [header, ...rows].join('\r\n') + '\r\n';
}

export async function collectFilteredTransactions(request, filters, signal) {
  const records = new Map();
  let pages = 1;
  let expectedTotal;
  for (let page = 1; page <= pages; page++) {
    if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    query.set('page', String(page)); query.set('limit', '100');
    const { data } = await request(`/transactions?${query}`, { signal });
    if (expectedTotal === undefined) expectedTotal = data.pagination.total;
    if (data.pagination.page !== page || data.pagination.total !== expectedTotal) throw new Error('Transactions changed during export. Please retry.');
    pages = data.pagination.pages;
    for (const item of data.transactions) records.set(item._id, item);
  }
  if (records.size !== expectedTotal) throw new Error('Transactions changed during export. Please retry.');
  return [...records.values()];
}

export function downloadTransactionsCsv(transactions) {
  const url = URL.createObjectURL(new Blob([transactionsCsv(transactions)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
