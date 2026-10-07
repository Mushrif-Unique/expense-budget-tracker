export function validateCredentials(body, registration = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be a JSON object.';
  if (registration && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100)) {
    return 'Name is required and must be at most 100 characters.';
  }
  if (typeof body.email !== 'string' || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'A valid email address is required.';
  }
  if (typeof body.password !== 'string' || !body.password.length) return 'Password is required.';
  if (Buffer.byteLength(body.password, 'utf8') > 72) return 'Password must be at most 72 UTF-8 bytes.';
  if (registration && body.password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}
