import jwt from 'jsonwebtoken';

export function validateJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    throw new Error('Set JWT_SECRET to a private random value of at least 32 characters in backend/.env.');
  }
}

export function generateToken(userId) {
  validateJwtSecret();
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(userId), expiresIn: '1d', algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  validateJwtSecret();
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}
