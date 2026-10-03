import { useEffect, useSyncExternalStore } from 'react';
import { clearEpisodeLadderLeaderboardCache, emptyEpisodeLadderLeaderboard, episodeLeaderboardKey,
  episodeLadderLeaderboardResource, getEpisodeLadderLeaderboard } from '../services/episodeLadderLeaderboardApi';
import { useLeaderboardRefresh } from './useLeaderboardRefresh';

export function useEpisodeLadderLeaderboard(universeId: string, accessToken: string | null, requestScope: string, enabled: boolean) {
  const key = episodeLeaderboardKey(universeId, accessToken, requestScope);
  const snapshot = useSyncExternalStore(episodeLadderLeaderboardResource.subscribe,
    () => enabled ? episodeLadderLeaderboardResource.peek(episodeLeaderboardKey(universeId, accessToken, requestScope)) : emptyEpisodeLadderLeaderboard,
    () => emptyEpisodeLadderLeaderboard);
  useLeaderboardRefresh(key, enabled, () => getEpisodeLadderLeaderboard(universeId, accessToken, requestScope));
  useEffect(() => {
    if (enabled && snapshot === emptyEpisodeLadderLeaderboard) void getEpisodeLadderLeaderboard(universeId, accessToken, requestScope).catch(() => {});
  }, [enabled, snapshot, universeId, accessToken, requestScope]);
  return { ...snapshot, retry: () => clearEpisodeLadderLeaderboardCache(universeId, requestScope) };
}
