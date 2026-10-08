import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { validateTransaction, transactionFields, validateTransactionQuery, escapeSearch } from '../utils/transactionValidation.js';

const notFound = res => res.status(404).json({ success: false, message: 'Transaction not found' });
const badRequest = (res, message) => res.status(400).json({ success: false, message });

export async function listTransactions(req, res) {
  const error = validateTransactionQuery(req.query);
  if (error) return badRequest(res, error);
  const filter = { user: req.user.id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.category?.trim()) filter.category = { $regex: `^${escapeSearch(req.query.category.trim())}$`, $options: 'i' };
  if (req.query.search?.trim()) {
    const expression = { $regex: escapeSearch(req.query.search.trim()), $options: 'i' };
    filter.$or = [{ description: expression }, { category: expression }];
  }
  const transactions = await Transaction.find(filter).sort({ date: -1, _id: -1 });
  return res.json({ success: true, message: 'Transactions retrieved', data: { transactions } });
}

export async function createTransaction(req, res) {
  const error = validateTransaction(req.body);
  if (error) return badRequest(res, error);
  const transaction = await Transaction.create({ ...transactionFields(req.body), user: req.user.id });
  return res.status(201).json({ success: true, message: 'Transaction created successfully', data: { transaction } });
}

export async function getTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction retrieved', data: { transaction } });
}

export async function updateTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const error = validateTransaction(req.body);
  if (error) return badRequest(res, error);
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: transactionFields(req.body) },
    { returnDocument: 'after', runValidators: true },
  );
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction updated successfully', data: { transaction } });
}

export async function deleteTransaction(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return badRequest(res, 'Invalid transaction ID');
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!transaction) return notFound(res);
  return res.json({ success: true, message: 'Transaction deleted successfully', data: null });
}
