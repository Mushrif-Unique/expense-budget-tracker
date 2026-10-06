export async function getHealth(signal) {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('Set VITE_API_URL in frontend/.env and restart Vite.');
  }

  const response = await fetch(`${baseUrl}/health`, { signal });
  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new Error(result.message || 'The API health check failed.');
  }
  return result;
}
