import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import User from '../models/User.js';
import { validateJwtSecret } from '../utils/jwt.js';

dotenv.config({ quiet: true });
validateJwtSecret();
const dbName = `expense_tracker_auth_test_${randomUUID().replaceAll('-', '')}`;
let server;
let checks = 0;
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 5000 });
  await User.init();
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, status, body, token) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    assert.equal(result.success, status < 400);
    if (result.data?.user) assert.equal(result.data.user.password, undefined);
    checks++;
    return result;
  }
  // Error messages may mention passwords; only inspect payload fields for leaks below.
  const originalPassword = 'StrongPass123!';
  const account = { name: ' Test User ', email: ' TEST@example.com ', password: originalPassword };
  const registered = await request('/api/auth/register', 201, account);
  assert.equal(registered.data.user.email, 'test@example.com');
  assert.equal(registered.data.user.name, 'Test User');
  const stored = await User.findById(registered.data.user.id).select('+password');
  assert.notEqual(stored.password, originalPassword);
  assert.ok(await bcrypt.compare(originalPassword, stored.password));
  assert.equal((await User.findById(stored.id)).password, undefined);
  assert.equal(stored.toJSON().password, undefined);
  await request('/api/auth/register', 409, account);
  const login = await request('/api/auth/login', 200, { email: account.email, password: originalPassword });
  await request('/api/auth/me', 200, undefined, `Bearer ${login.data.token}`);
  await request('/api/auth/me', 401);
  await request('/api/auth/me', 401, undefined, 'Bearer invalid');
  await request('/api/auth/me', 401, undefined, `Basic ${login.data.token}`);
  for (const token of [
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, expiresIn: -1 }),
    jwt.sign({}, 'different-secret', { subject: stored.id }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, algorithm: 'HS384' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: 'invalid-id' }),
    jwt.sign({}, process.env.JWT_SECRET, { subject: stored.id, notBefore: '1h' }),
  ]) await request('/api/auth/me', 401, undefined, `Bearer ${token}`);
  await request('/api/auth/login', 401, { email: 'absent@example.com', password: originalPassword });
  await request('/api/auth/login', 401, { email: account.email, password: 'wrong-password' });
  for (const body of [{}, [], { ...account, name: '' }, { ...account, email: 'invalid' }, { ...account, email: { $ne: null } }, { ...account, password: 'short' }, { ...account, password: 'é'.repeat(37) }, { ...account, password: 12345678 }]) {
    await request('/api/auth/register', 400, body);
  }
  const parallel = await Promise.all([1, 2].map(() => fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...account, email: 'race@example.com' }) })));
  assert.deepEqual(parallel.map(r => r.status).sort(), [201, 409]);
  checks++;
  for (const [body, status] of [['{', 400], [JSON.stringify({ text: 'x'.repeat(11000) }), 413]]) {
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status); checks++;
  }
  await request('/api/health', 200);
  await request('/api/missing', 404);
  await User.deleteOne({ _id: stored.id });
  await request('/api/auth/me', 401, undefined, `Bearer ${login.data.token}`);
  console.info(`PASS: ${checks} API checks, password hashing, normalized identity, unique index, and safe serialization.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

