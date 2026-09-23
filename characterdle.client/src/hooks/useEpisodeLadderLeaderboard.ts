import { useEffect, useSyncExternalStore } from 'react';
import {
  clearEpisodeLadderLeaderboardCache,
  emptyEpisodeLadderLeaderboard,
  getEpisodeLadderLeaderboard,
  getEpisodeLadderLeaderboardSnapshot,
  subscribeEpisodeLadderLeaderboard,
} from '../services/episodeLadderLeaderboardApi';

export function useEpisodeLadderLeaderboard(
  universeId: string, accessToken: string | null, requestScope: string, enabled: boolean,
) {
  const snapshot = useSyncExternalStore(
    subscribeEpisodeLadderLeaderboard,
    () => enabled ? getEpisodeLadderLeaderboardSnapshot(universeId, requestScope) : emptyEpisodeLadderLeaderboard,
    () => emptyEpisodeLadderLeaderboard,
  );

  useEffect(() => {
    if (!enabled || snapshot.data || snapshot.error) return;
    void getEpisodeLadderLeaderboard(universeId, accessToken, requestScope).catch(() => {
      // Errors are exposed through the cache snapshot and the existing retry UI.
    });
  }, [universeId, accessToken, requestScope, enabled, snapshot]);

  return {
    ...snapshot,
    retry: () => clearEpisodeLadderLeaderboardCache(universeId, requestScope),
  };
}
