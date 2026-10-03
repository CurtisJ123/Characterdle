import { useEffect, useEffectEvent, useRef } from 'react';
import { ladderGuestStorageKey } from '../lib/guestIdentity';
import { clearLeaderboardCache } from '../services/leaderboardApi';

export function useLeaderboardRefresh(key: string, enabled: boolean, load: () => Promise<unknown>) {
  const identity = (JSON.parse(key) as string[])[1];
  const previousIdentity = useRef(identity);
  const refresh = useEffectEvent(() => { if (enabled && !document.hidden) void load().catch(() => { /* Snapshot shows the error. */ }); });
  useEffect(() => {
    if (!enabled) return;
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      clearLeaderboardCache();
    }
    refresh();
    const visible = () => refresh();
    const storage = (event: StorageEvent) => { if (event.key === ladderGuestStorageKey || event.key === null) { clearLeaderboardCache(); refresh(); } };
    window.addEventListener('focus', visible); window.addEventListener('online', visible); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 15_000);
    return () => {
      window.removeEventListener('focus', visible); window.removeEventListener('online', visible); window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible); window.clearInterval(timer);
    };
  }, [key, enabled, identity]);
}
