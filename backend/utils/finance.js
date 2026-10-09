export function currentMonth(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return { year, month, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export function roundMoney(value) {
  return Number(value.toFixed(2));
}

// Sum as decimal in MongoDB before converting to JSON numbers.
export const sumAmount = { $sum: { $toDecimal: '$amount' } };
export const roundedTotal = { $toDouble: { $round: ['$total', 2] } };
