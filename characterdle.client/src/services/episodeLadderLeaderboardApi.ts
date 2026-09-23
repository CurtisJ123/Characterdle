import { buildApiUrl } from '../lib/runtimeConfig';
import type { EpisodeLadderLeaderboardData } from '../types/leaderboard';

export interface EpisodeLadderLeaderboardSnapshot {
  data: EpisodeLadderLeaderboardData | null;
  error: Error | null;
  isLoading: boolean;
}

export const emptyEpisodeLadderLeaderboard: EpisodeLadderLeaderboardSnapshot = {
  data: null, error: null, isLoading: true,
};

interface CacheEntry {
  universeId: string;
  requestScope: string;
  controller: AbortController;
  request: Promise<EpisodeLadderLeaderboardData>;
  snapshot: EpisodeLadderLeaderboardSnapshot;
}

const entries = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
const cacheKey = (universeId: string, requestScope: string) => JSON.stringify([universeId, requestScope]);
const notify = () => listeners.forEach(listener => listener());

export function subscribeEpisodeLadderLeaderboard(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getEpisodeLadderLeaderboardSnapshot(universeId: string, requestScope: string) {
  return entries.get(cacheKey(universeId, requestScope))?.snapshot ?? emptyEpisodeLadderLeaderboard;
}

export function clearEpisodeLadderLeaderboardCache(universeId?: string, requestScope?: string) {
  for (const [key, entry] of entries) {
    if (universeId !== undefined && entry.universeId !== universeId) continue;
    if (requestScope !== undefined && entry.requestScope !== requestScope) continue;
    entries.delete(key);
    entry.controller.abort();
  }
  notify();
}

export function getEpisodeLadderLeaderboard(
  universeId: string, accessToken: string | null, requestScope: string,
): Promise<EpisodeLadderLeaderboardData> {
  const key = cacheKey(universeId, requestScope);
  const cached = entries.get(key);
  if (cached && !cached.snapshot.error) return cached.request;

  // Requests belong to the cache, not an individual tab, so navigation can reuse in-flight work.
  const controller = new AbortController();
  const entry: CacheEntry = {
    universeId, requestScope, controller, snapshot: { ...emptyEpisodeLadderLeaderboard },
    request: fetchEpisodeLadderLeaderboard(universeId, accessToken, controller.signal).then(data => {
      if (entries.get(key) === entry) {
        entry.snapshot = { data, error: null, isLoading: false };
        notify();
      }
      return data;
    }).catch((error: unknown) => {
      // An older response must not repopulate a cache cleared after a game completion.
      if (entries.get(key) === entry) {
        entry.snapshot = { data: null, error: error instanceof Error ? error : new Error('Unable to load leaderboard.'), isLoading: false };
        notify();
      }
      throw error;
    }),
  };
  entries.set(key, entry);
  notify();
  return entry.request;
}

async function fetchEpisodeLadderLeaderboard(
  universeId: string, accessToken: string | null, signal: AbortSignal,
): Promise<EpisodeLadderLeaderboardData> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/leaderboard/episode-ladder`), {
    headers: { Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('Unable to load Episode Ladder leaderboard. Please try again.');
  return await response.json() as EpisodeLadderLeaderboardData;
}
