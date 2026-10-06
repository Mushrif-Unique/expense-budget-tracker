import mongoose from 'mongoose';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in backend/.env.');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.info('MongoDB connected.');
  } catch {
    throw new Error('MongoDB connection failed. Check MONGODB_URI and database availability.');
  }
}
