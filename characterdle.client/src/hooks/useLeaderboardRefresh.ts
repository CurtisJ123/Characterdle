import { useEffect, useEffectEvent, useRef } from 'react';
import { ladderGuestStorageKey, leaderboardScope } from '../lib/guestIdentity';
import { clearLeaderboardIdentityCache } from '../services/leaderboardApi';

export function useLeaderboardRefresh(key: string, enabled: boolean, load: () => Promise<unknown>) {
  const identity = (JSON.parse(key) as string[])[1];
  const previousIdentity = useRef(identity);
  const refresh = useEffectEvent(() => { if (enabled && !document.hidden) void load().catch(() => { /* Snapshot shows the error. */ }); });
  useEffect(() => {
    if (!enabled) return;
    const updateIdentity = (nextIdentity: string) => {
      if (previousIdentity.current === nextIdentity) return;
      const oldIdentity = previousIdentity.current;
      previousIdentity.current = nextIdentity;
      // Both leaderboard hooks run this effect. Never cancel the other's new request.
      clearLeaderboardIdentityCache(oldIdentity);
    };
    updateIdentity(identity);
    refresh();
    const visible = () => refresh();
    const storage = (event: StorageEvent) => {
      if (event.key !== ladderGuestStorageKey && event.key !== null) return;
      if (identity.startsWith('guest:')) updateIdentity(leaderboardScope(null, 'guest'));
      refresh();
    };
    window.addEventListener('focus', visible); window.addEventListener('online', visible); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 15_000);
    return () => {
      window.removeEventListener('focus', visible); window.removeEventListener('online', visible); window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible); window.clearInterval(timer);
    };
  }, [key, enabled, identity]);
}
