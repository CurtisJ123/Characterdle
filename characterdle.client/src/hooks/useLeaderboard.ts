import { useEffect, useSyncExternalStore } from 'react';
import { getLeaderboard, leaderboardCacheKey, leaderboardResource } from '../services/leaderboardApi';
import { useLeaderboardRefresh } from './useLeaderboardRefresh';
import type { UniverseLeaderboardState } from '../types/leaderboard';

export function useLeaderboard(universeId: string, accessToken: string | null, requestScope: string): UniverseLeaderboardState {
  const key = leaderboardCacheKey(universeId, accessToken, requestScope);
  const snapshot = useSyncExternalStore(leaderboardResource.subscribe,
    () => leaderboardResource.peek(leaderboardCacheKey(universeId, accessToken, requestScope)), () => leaderboardResource.empty);
  useLeaderboardRefresh(key, true, () => getLeaderboard(universeId, accessToken, requestScope));
  useEffect(() => {
    if (snapshot === leaderboardResource.empty) void getLeaderboard(universeId, accessToken, requestScope).catch(() => {});
  }, [snapshot, universeId, accessToken, requestScope]);
  return snapshot;
}
