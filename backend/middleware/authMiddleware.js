import mongoose from 'mongoose';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';

export async function protect(req, res, next) {
  const unauthorized = () => res.status(401).json({ success: false, message: 'A valid authentication token is required.' });
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
  if (!match) return unauthorized();
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return unauthorized();
    return next(error);
  }
  if (!payload || typeof payload.sub !== 'string' || !mongoose.isObjectIdOrHexString(payload.sub)) return unauthorized();
  const user = await User.findById(payload.sub);
  if (!user) return unauthorized();
  req.user = user;
  return next();
}
