import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { generateToken } from '../utils/jwt.js';
import { validateCredentials } from '../utils/validation.js';

export function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

export async function register(req, res) {
  const error = validateCredentials(req.body, true);
  if (error) return res.status(400).json({ success: false, message: error });
  const email = req.body.email.trim().toLowerCase();
  if (await User.exists({ email })) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  const password = await bcrypt.hash(req.body.password, 12);
  const user = await User.create({ name: req.body.name.trim(), email, password });
  return res.status(201).json({
    success: true, message: 'Registration successful',
    data: { user: safeUser(user), token: generateToken(user.id) },
  });
}

export async function login(req, res) {
  const error = validateCredentials(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  const user = await User.findOne({ email: req.body.email.trim().toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }
  return res.json({
    success: true, message: 'Login successful',
    data: { user: safeUser(user), token: generateToken(user.id) },
  });
}

export function getMe(req, res) {
  return res.json({ success: true, message: 'Authenticated user', data: { user: safeUser(req.user) } });
}
