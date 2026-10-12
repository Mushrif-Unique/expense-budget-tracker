export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (!base) throw new ApiError('The API address is not configured.');
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw new ApiError(result?.message || 'The server could not complete your request.', response.status);
  return result;
}

export const getHealth = signal => apiRequest('/health', { signal });
