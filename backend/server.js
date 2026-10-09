import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { validateJwtSecret } from './utils/jwt.js';
import User from './models/User.js';
import Budget from './models/Budget.js';

dotenv.config({ quiet: true });

async function startServer() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set PORT to a valid port number in backend/.env.');
  }
  if (!process.env.CLIENT_URL) {
    throw new Error('Set CLIENT_URL in backend/.env.');
  }

  validateJwtSecret();
  await connectDatabase();
  await Promise.all([User.init(), Budget.init()]);
  const server = createApp().listen(port, () => {
    console.info(`Expense & Budget Tracker API listening on port ${port}.`);
  });

  server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? 'Backend port is already in use. Change PORT or stop the conflicting server.' : 'HTTP server failed to start.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });

  async function shutdown() {
    server.close(async () => {
      await mongoose.disconnect();
      process.exitCode = 0;
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch(async (error) => {
  console.error('Backend startup failed. Check environment settings, MongoDB availability, and database index configuration.');
  await mongoose.disconnect();
  process.exitCode = 1;
});
