import { useEffect } from 'react';

interface PreloadOptions {
  ready: boolean;
  userId?: string;
  token: string | null;
  fullArchiveAccess?: boolean;
  gameId?: number | null;
  levels?: string;
  warmPage?: boolean;
}

export function useEpisodeLadderPreload({ ready, userId, token, fullArchiveAccess = false,
  gameId = null, levels = '1', warmPage = true }: PreloadOptions) {
  useEffect(() => {
    if (!ready) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return;
    let cancelled = false;
    let running = false;
    let timer: number | undefined;
    let idle: number | undefined;
    const eligible = () => !cancelled && !document.hidden && navigator.onLine;
    async function warm() {
      if (!eligible() || running) return;
      running = true;
      try {
        const loader = await import('../services/episodeLadderLoader');
        if (!eligible() || !loader.canWarmLadder()) return;
        const scope = `${userId ? `user:${userId}` : 'guest'}:${fullArchiveAccess ? 'full' : 'limited'}`;
        if (warmPage) void import('../lib/pageModules').then(({ pageModules }) => pageModules.episodeLadder()).catch(() => {});
        for (const level of levels.split(',').map(Number)) {
          if (!eligible() || !loader.canWarmLadder()) break;
          const snapshot = await loader.loadLadderGame(scope, gameId, level, token, { background: true });
          if (!eligible()) break;
          loader.warmLadderPortraits(snapshot.game);
          // One difficulty at a time, yielding between requests for input and rendering.
          await new Promise(resolve => window.setTimeout(resolve, 150));
        }
      } catch { /* Speculative failures are retried normally when the player opens the game. */ }
      finally { running = false; }
    }
    function schedule() {
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (!eligible()) return;
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => { void warm(); });
        else void warm();
      }, 600);
    }
    function intent(event: Event) {
      if ((event.target as Element | null)?.closest?.('a[href*="/game/episode_ladder"]')) void warm();
    }
    const start = () => { void document.fonts.ready.then(() => { if (!cancelled) schedule(); }); };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('online', schedule);
    document.addEventListener('pointerover', intent);
    document.addEventListener('focusin', intent);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      window.removeEventListener('load', start);
      document.removeEventListener('visibilitychange', schedule);
      window.removeEventListener('online', schedule);
      document.removeEventListener('pointerover', intent);
      document.removeEventListener('focusin', intent);
    };
  }, [ready, userId, token, fullArchiveAccess, gameId, levels, warmPage]);
}
