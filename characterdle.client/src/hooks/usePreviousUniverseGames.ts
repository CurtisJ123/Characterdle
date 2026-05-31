import { useEffect, useState } from 'react';
import { getPreviousUniverseGames } from '../services/universeGameApi';
import type { PreviousUniverseGamesState } from '../types/universeGame';

export function usePreviousUniverseGames(universeId: string): PreviousUniverseGamesState {
  const [state, setState] = useState<PreviousUniverseGamesState>({
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

    async function loadPreviousGames() {
      try {
        const data = await getPreviousUniverseGames(universeId);

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
          error: error instanceof Error ? error : new Error('Unable to load previous games.'),
          isLoading: false,
        });
      }
    }

    void loadPreviousGames();

    return () => {
      isMounted = false;
    };
  }, [universeId]);

  return state;
}
