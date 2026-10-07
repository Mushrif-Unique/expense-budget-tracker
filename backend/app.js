import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL }));
  app.use(express.json({ limit: '10kb' }));
  app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Expense & Budget Tracker API is running' });
  });
  app.use('/api/auth', authRoutes);
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
