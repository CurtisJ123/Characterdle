import { useEffect, useState } from 'react';
import { isPublicCommentsPath, updatesRequest } from '../services/announcementsApi';
import { ladderGuestId } from '../lib/guestIdentity';

export function useUpdatesResource<T>(path: string | null, token: string | null = null, initialData?: T, keepPreviousData = false) {
  const [version, setVersion] = useState(0);
  const scope = JSON.stringify([path, token, !token && isPublicCommentsPath(path) ? ladderGuestId() : null]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>(
    () => initialData ? { key: `${scope}:0`, data: initialData } : { key: '' },
  );
  const key = `${scope}:${version}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void updatesRequest<T>(path, token, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setResult({ key, data }); },
      error => { if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Unable to load updates.' }); },
    );
    return () => controller.abort();
  }, [path, token, key]);
  return { data: result.key === key || (keepPreviousData && result.key.startsWith(`${scope}:`)) ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: !!path && (result.key !== key || (!result.data && !result.error)),
    reload: () => setVersion(value => value + 1) };
}
