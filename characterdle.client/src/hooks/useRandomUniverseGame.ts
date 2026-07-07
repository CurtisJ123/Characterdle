import { useEffect, useState } from 'react';
import { getRandomUniverseGame } from '../services/universeGameApi';
import type { GameMode } from '../types/game';
import type { CurrentUniverseGameState } from '../types/universeGame';

export function useRandomUniverseGame(
  universeId: string,
  mode: GameMode,
  accessToken: string | null,
  refreshKey = 0,
): CurrentUniverseGameState {
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

    async function loadRandomGame() {
      try {
        const data = await getRandomUniverseGame(universeId, mode, accessToken);

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
          error: error instanceof Error ? error : new Error('Unable to resolve a random game.'),
          isLoading: false,
        });
      }
    }

    void loadRandomGame();

    return () => {
      isMounted = false;
    };
  }, [accessToken, mode, refreshKey, universeId]);

  return state;
}
