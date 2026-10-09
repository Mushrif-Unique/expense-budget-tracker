import Budget from '../models/Budget.js';
import { getBudgetSummary } from '../services/budgetService.js';
import { currentMonth } from '../utils/finance.js';

export async function getCurrentBudget(req, res) {
  const budget = await getBudgetSummary(req.user.id);
  return res.json({ success: true, message: 'Current monthly budget retrieved', data: { budget } });
}

export async function setCurrentBudget(req, res) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'amount') || typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0) {
    return res.status(400).json({ success: false, message: 'Supply only amount as a finite number greater than or equal to zero.' });
  }
  const period = currentMonth();
  const filter = { user: req.user.id, month: period.month, year: period.year };
  try {
    await Budget.findOneAndUpdate(filter, { $set: { amount: body.amount } }, { upsert: true, runValidators: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Concurrent first saves can race on the unique monthly index.
    await Budget.findOneAndUpdate(filter, { $set: { amount: body.amount } }, { runValidators: true, returnDocument: 'after' });
  }
  const budget = await getBudgetSummary(req.user.id, period);
  return res.json({ success: true, message: 'Monthly budget saved successfully', data: { budget } });
}
