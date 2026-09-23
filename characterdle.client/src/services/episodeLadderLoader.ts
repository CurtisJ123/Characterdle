import { EpisodeLadderCache } from '../lib/episodeLadderCache';
import { getCharacterPortraitUrl } from '../lib/characterPortraits';
import { readLadderDifficultyStates, readLadderProgress, readLegacyLadderProgress } from '../lib/episodeLadderProgress';
import { EpisodeLadderApiError, requestEpisodeLadder } from './episodeLadderApi';
import type { EpisodeLadderGame } from '../types/episodeLadder';

export const ladderCache = new EpisodeLadderCache();
let activeScope: string | undefined;
let foregroundWork = 0;
const portraits = new Set<string>();

export function configureLadderSession(scope: string) {
  if (activeScope !== scope) { ladderCache.clear(); activeScope = scope; }
}

export function beginLadderMutation(scope: string, id: number, level: number) {
  foregroundWork++;
  ladderCache.cancelBackground();
  ladderCache.cancelReads(scope, id, level);
  return () => { foregroundWork--; };
}

export function canWarmLadder() { return foregroundWork === 0; }

export async function loadLadderGame(scope: string, id: number | null, level: number, token: string | null,
  { background = false, force = false } = {}) {
  configureLadderSession(scope);
  if (!background) foregroundWork++;
  try {
    return await ladderCache.load(scope, id, level, async signal => {
      let game = await requestEpisodeLadder(id, token, signal, undefined, level, background);
      if (scope.startsWith('guest:')) {
        const saved = readLadderProgress('guest', game.gameId, level) ?? readLegacyLadderProgress('guest', game);
        if (saved?.attempts.length) {
          game = await requestEpisodeLadder(game.gameId, null, signal, { attempts: saved.attempts, restoreGuest: true }, level, background);
        }
        game = { ...game, difficulties: readLadderDifficultyStates('guest', game.gameId) };
      }
      return game;
    }, { background, force });
  } catch (error) {
    if (error instanceof EpisodeLadderApiError && [401, 403].includes(error.status)) ladderCache.invalidate(scope, id, level);
    throw error;
  } finally { if (!background) foregroundWork--; }
}

export function warmLadderPortraits(game: EpisodeLadderGame) {
  for (const event of game.events) {
    const url = event.characterName ? getCharacterPortraitUrl({ displayName: event.characterName, portraitUrl: event.portraitUrl }) : null;
    if (!url || portraits.has(url)) continue;
    if (portraits.size >= 100) portraits.delete(portraits.values().next().value!);
    portraits.add(url);
    const image = new Image();
    image.fetchPriority = 'low';
    image.decoding = 'async';
    image.src = url;
    void image.decode().catch(() => { portraits.delete(url); });
  }
}

// AppShell sends this without importing the Ladder bundle on other routes.
if (typeof window !== 'undefined') {
  window.addEventListener('ladder-session-changed', event => configureLadderSession((event as CustomEvent<string>).detail));
  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith('episode-ladder:got:')) {
      ladderCache.clear();
      window.dispatchEvent(new Event('ladder-progress-changed'));
    }
  });
  window.addEventListener('ladder-guest-imported', event => {
    const { userId, game } = (event as CustomEvent<{ userId: string; game: EpisodeLadderGame }>).detail;
    if (activeScope?.startsWith(`user:${userId}:`)) ladderCache.set(activeScope, game);
  });
}
