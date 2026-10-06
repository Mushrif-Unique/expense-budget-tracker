import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Expense & Budget Tracker API is running',
    });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
    const message = status === 400 ? 'Invalid JSON request body' :
      status === 413 ? 'Request body is too large' : 'Internal server error';
    res.status(status).json({ success: false, message });
  });

  return app;
}
