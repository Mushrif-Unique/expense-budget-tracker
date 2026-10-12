export function validateAuth(values, register) {
  const errors = {};
  if (register && (!values.name.trim() || values.name.trim().length > 100)) errors.name = 'Enter a name of 1–100 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  else if (register && values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (new TextEncoder().encode(values.password).length > 72) errors.password = 'Password must be at most 72 UTF-8 bytes.';
  return errors;
}
