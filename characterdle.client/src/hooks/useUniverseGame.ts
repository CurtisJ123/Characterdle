import { useEffect, useState } from 'react';
import { getUniverseGame } from '../services/universeGameApi';
import type { CurrentUniverseGameState } from '../types/universeGame';

export function useUniverseGame(universeId: string, gameId: number | null): CurrentUniverseGameState {
  const [state, setState] = useState<CurrentUniverseGameState>({
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

    async function loadGame() {
      try {
        const data = await getUniverseGame(universeId, gameId);

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
          error: error instanceof Error ? error : new Error('Unable to load game data.'),
          isLoading: false,
        });
      }
    }

    void loadGame();

    return () => {
      isMounted = false;
    };
  }, [gameId, universeId]);

  return state;
}
