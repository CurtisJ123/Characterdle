import { useEffect, useState } from 'react';
import { getLeaderboard } from '../services/leaderboardApi';
import type { UniverseLeaderboardState } from '../types/leaderboard';

export function useLeaderboard(
  universeId: string,
  accessToken: string | null,
  requestScope: string,
): UniverseLeaderboardState {
  const [state, setState] = useState<UniverseLeaderboardState>({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    setState({
      data: null,
      error: null,
      isLoading: true,
    });

    async function loadLeaderboard() {
      try {
        const data = await getLeaderboard(universeId, accessToken, requestScope);

        if (!isMounted) {
          return;
        }

        setState({
          data,
          error: null,
          isLoading: false,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setState({
          data: null,
          error: error instanceof Error ? error : new Error('Unable to load leaderboard data.'),
          isLoading: false,
        });
      }
    }

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [accessToken, requestScope, universeId]);

  return state;
}
