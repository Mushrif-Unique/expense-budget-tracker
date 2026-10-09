import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  month: { type: Number, required: true, min: 1, max: 12, validate: Number.isInteger },
  year: { type: Number, required: true, min: 1, max: 9999, validate: Number.isInteger },
  amount: { type: Number, required: true, validate: { validator: value => Number.isFinite(value) && value >= 0, message: 'Budget must be a finite nonnegative number.' } },
}, { timestamps: true });

budgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });
export default mongoose.model('Budget', budgetSchema);
