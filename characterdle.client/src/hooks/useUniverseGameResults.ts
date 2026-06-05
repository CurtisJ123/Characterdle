import { useEffect, useState } from 'react';
import { getGameResults } from '../services/profileApi';
import type { ProfileGameResultsState } from '../types/profile';

export function useUniverseGameResults(accessToken: string | null, universeId: string): ProfileGameResultsState {
  const [state, setState] = useState<ProfileGameResultsState>({
    data: [],
    error: null,
    isLoading: Boolean(accessToken),
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!accessToken) {
        if (!isMounted) {
          return;
        }

        setState({
          data: [],
          error: null,
          isLoading: false,
        });
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: null,
        isLoading: true,
      }));

      try {
        const data = await getGameResults(accessToken, universeId);

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
          data: [],
          error: error instanceof Error ? error : new Error('Unable to load game results.'),
          isLoading: false,
        });
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [accessToken, universeId]);

  return state;
}
