import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function useApiData(path) {
  const { request } = useAuth();
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: true, error: '' });
    request(path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState({ data: result.data, loading: false, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [path, request, revision]);
  return { ...state, refresh };
}
