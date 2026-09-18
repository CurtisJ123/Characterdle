import { useEffect, useState } from 'react';
import { updatesRequest } from '../services/announcementsApi';

export function useUpdatesResource<T>(path: string | null, token: string | null = null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  const key = `${path}:${token}:${version}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void updatesRequest<T>(path, token, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setResult({ key, data }); },
      error => { if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Unable to load updates.' }); },
    );
    return () => controller.abort();
  }, [path, token, key]);
  return { data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!path && (result.key !== key || (!result.data && !result.error)),
    reload: () => setVersion(value => value + 1) };
}
