import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { roundMoney, sumAmount, roundedTotal } from '../utils/finance.js';

export async function getDashboardSummary(req, res) {
  const user = new mongoose.Types.ObjectId(req.user.id);
  const [totals, recentTransactions, expensesByCategory, budget] = await Promise.all([
    Transaction.aggregate([
      { $match: { user } },
      { $group: { _id: '$type', total: sumAmount } },
      { $project: { _id: 0, type: '$_id', total: roundedTotal } },
    ]),
    Transaction.find({ user }).sort({ date: -1, _id: -1 }).limit(5).lean(),
    Transaction.aggregate([
      { $match: { user, type: 'expense' } },
      { $group: { _id: '$category', total: sumAmount } },
      { $project: { _id: 0, category: '$_id', total: roundedTotal } },
      { $sort: { total: -1, category: 1 } },
    ]),
    getBudgetSummary(user),
  ]);
  const totalIncome = totals.find(item => item.type === 'income')?.total ?? 0;
  const totalExpenses = totals.find(item => item.type === 'expense')?.total ?? 0;
  return res.json({ success: true, message: 'Dashboard summary retrieved', data: {
    totalIncome, totalExpenses, balance: roundMoney(totalIncome - totalExpenses),
    recentTransactions, expensesByCategory, budget,
  } });
}
