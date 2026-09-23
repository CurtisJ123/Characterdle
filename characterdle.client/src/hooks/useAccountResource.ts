import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';
import type { AccountResource } from '../lib/accountResource';

export function useAccountResource<T>(resource: AccountResource<T>, userId: string | null,
  token: string | null, scope: string, loader: (token: string, signal: AbortSignal) => Promise<T>) {
  const enabled = Boolean(userId && token);
  const snapshot = useSyncExternalStore(resource.subscribe,
    () => enabled ? resource.peek(userId!, scope) : resource.signedOut,
    () => enabled ? resource.empty : resource.signedOut);
  const refresh = (force = false) => enabled
    ? resource.load(userId!, scope, signal => loader(token!, signal), force)
    : Promise.resolve();
  const refreshLatest = useEffectEvent(refresh);

  useEffect(() => {
    if (!enabled) return;
    void refreshLatest();
    const refreshVisible = () => { if (!document.hidden) void refreshLatest(); };
    const reconnect = () => { if (!document.hidden) void refreshLatest(true); };
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, 60_000);
    return () => {
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.clearInterval(timer);
    };
  }, [enabled, userId, token, scope]);

  return { ...snapshot, reload: () => refresh(true) };
}
