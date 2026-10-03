import { useEffect, useEffectEvent } from 'react';
import { ladderGuestId, ladderGuestStorageKey } from '../lib/guestIdentity';

export const commentVisibilityChanged = 'characterdle:comment-visibility-changed';

export function useCommentRefresh(reload: () => void, enabled = true) {
  const refresh = useEffectEvent(reload);
  useEffect(() => {
    if (!enabled) return;
    let lastRefresh = Date.now();
    let guestId = ladderGuestId();
    const check = (force = false) => {
      if (document.hidden) return;
      const nextGuestId = ladderGuestId();
      if (force || nextGuestId !== guestId || Date.now() - lastRefresh >= 45_000) {
        guestId = nextGuestId;
        lastRefresh = Date.now();
        refresh();
      }
    };
    const visible = () => check();
    const changed = () => check(true);
    const storage = (event: StorageEvent) => {
      if (event.key === ladderGuestStorageKey || event.key === null) changed();
    };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', storage);
    window.addEventListener(commentVisibilityChanged, changed);
    const timer = window.setInterval(visible, 15_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('storage', storage);
      window.removeEventListener(commentVisibilityChanged, changed);
    };
  }, [enabled]);
}
