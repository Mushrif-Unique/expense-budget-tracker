import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/api.js';

const AuthContext = createContext(null);
const storageKey = 'expense-tracker-token';
const readToken = () => { try { return localStorage.getItem(storageKey); } catch { return null; } };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => readToken() ? 'loading' : 'guest');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const currentToken = useRef(token);

  const logout = useCallback(() => {
    generation.current++;
    currentToken.current = null;
    try { localStorage.removeItem(storageKey); } catch { /* Session is still cleared in memory. */ }
    setToken(null); setUser(null); setStatus('guest'); setError('');
  }, []);

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== storageKey && event.key !== null) return;
      generation.current++;
      const next = readToken();
      currentToken.current = next;
      setUser(null); setToken(next); setError(''); setStatus(next ? 'loading' : 'guest');
      setAttempt(value => value + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const version = generation.current;
    setStatus('loading'); setError('');
    apiRequest('/auth/me', { token, signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted && version === generation.current) { setUser(result.data.user); setStatus('authenticated'); }
      })
      .catch(failure => {
        if (controller.signal.aborted || version !== generation.current) return;
        if (failure.status === 401) logout();
        else { setError(failure.message); setStatus('error'); }
      });
    return () => controller.abort();
  }, [token, attempt, logout]);

  useEffect(() => {
    if (!token || status !== 'authenticated') return;
    try {
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(encoded));
      if (!Number.isFinite(exp)) { logout(); return; }
      const remaining = exp * 1000 - Date.now();
      if (remaining <= 0) { logout(); return; }
      const timeout = setTimeout(logout, Math.min(remaining, 2147483647));
      return () => clearTimeout(timeout);
    } catch { logout(); }
  }, [token, status, logout]);
  async function authenticate(mode, values) {
    const version = generation.current;
    const result = await apiRequest(`/auth/${mode}`, { method: 'POST', body: values });
    if (version !== generation.current) return;
    try { localStorage.setItem(storageKey, result.data.token); }
    catch { throw new Error('Browser storage is unavailable. Enable site storage and try signing in again.'); }
    currentToken.current = result.data.token;
    setToken(result.data.token); setUser(result.data.user); setStatus('authenticated'); setError('');
  }

  async function request(path, options = {}) {
    const requestToken = currentToken.current;
    try { return await apiRequest(path, { ...options, token: requestToken }); }
    catch (failure) {
      if (failure.status === 401 && currentToken.current === requestToken) logout();
      throw failure;
    }
  }

  return <AuthContext.Provider value={{ user, status, error, authenticate, logout, request, retry: () => setAttempt(value => value + 1) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
