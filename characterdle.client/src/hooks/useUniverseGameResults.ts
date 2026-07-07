import { useEffect, useState } from 'react';
import {
  cacheUniverseGameResults,
  readCachedUniverseGameResults,
  syncPersistedGameResultsToLocalProgress,
} from '../lib/characterGameProgress';
import { getGameResults } from '../services/profileApi';
import type { ProfileGameResultsState } from '../types/profile';

export function useUniverseGameResults(
  accessToken: string | null,
  universeId: string,
  ownerKey = 'guest',
  enabled = true,
): ProfileGameResultsState {
  const [state, setState] = useState<ProfileGameResultsState>({
    data: enabled && accessToken ? readCachedUniverseGameResults(ownerKey, universeId) : [],
    error: null,
    isLoading: Boolean(enabled && accessToken),
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        data: [],
        error: null,
        isLoading: false,
      });
      return;
    }

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

      const cachedResults = readCachedUniverseGameResults(ownerKey, universeId);

      setState({
        data: cachedResults,
        error: null,
        isLoading: true,
      });

      try {
        const data = await getGameResults(accessToken, universeId);

        if (!isMounted) {
          return;
        }

        cacheUniverseGameResults(ownerKey, universeId, data);
        syncPersistedGameResultsToLocalProgress(ownerKey, universeId, data);

        setState({
          data,
          error: null,
          isLoading: false,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (cachedResults.length > 0) {
          syncPersistedGameResultsToLocalProgress(ownerKey, universeId, cachedResults);

          setState({
            data: cachedResults,
            error: null,
            isLoading: false,
          });
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
  }, [accessToken, enabled, ownerKey, universeId]);

  return state;
}
