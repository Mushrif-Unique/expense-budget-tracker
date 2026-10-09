import mongoose from 'mongoose';
import Budget from '../models/Budget.js';
import Transaction from '../models/Transaction.js';
import { currentMonth, roundMoney, sumAmount, roundedTotal } from '../utils/finance.js';

export async function getBudgetSummary(userId, period = currentMonth()) {
  const user = new mongoose.Types.ObjectId(String(userId));
  const [budget, totals] = await Promise.all([
    Budget.findOne({ user, month: period.month, year: period.year }).lean(),
    Transaction.aggregate([
      { $match: { user, type: 'expense', date: { $gte: period.start, $lt: period.end } } },
      { $group: { _id: null, total: sumAmount } },
      { $project: { _id: 0, total: roundedTotal } },
    ]),
  ]);
  const monthlyExpenses = totals[0]?.total ?? 0;
  const amount = budget ? roundMoney(budget.amount) : null;
  return {
    isSet: Boolean(budget), month: period.month, year: period.year, amount, monthlyExpenses,
    remaining: budget ? roundMoney(amount - monthlyExpenses) : null,
    overspent: budget ? roundMoney(Math.max(0, monthlyExpenses - amount)) : 0,
    progressPercentage: budget ? (amount > 0 ? roundMoney(monthlyExpenses / amount * 100) : 0) : null,
  };
}
