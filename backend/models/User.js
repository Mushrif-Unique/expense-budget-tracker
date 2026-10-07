import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, required: true, select: false },
}, {
  timestamps: true,
  toJSON: { transform(doc, result) { delete result.password; delete result.__v; return result; } },
});

export default mongoose.model('User', userSchema);
