import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  amount: { type: Number, required: true, validate: { validator: value => Number.isFinite(value) && value > 0, message: 'Amount must be a positive finite number.' } },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  date: { type: Date, required: true },
}, { timestamps: true });

transactionSchema.index({ user: 1, date: -1, _id: -1 });
export default mongoose.model('Transaction', transactionSchema);
