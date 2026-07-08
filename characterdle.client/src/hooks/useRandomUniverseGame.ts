import { useCallback, useEffect, useRef, useState } from 'react';
import { getRandomUniverseGame } from '../services/universeGameApi';
import type { GameMode } from '../types/game';
import type { CurrentUniverseGame, CurrentUniverseGameState } from '../types/universeGame';

interface UseRandomUniverseGameResult {
  advanceToNextGame: () => void;
  roundKey: number;
  state: CurrentUniverseGameState;
}

interface PreloadedRandomGameState {
  data?: CurrentUniverseGame;
  error?: Error;
  promise?: Promise<CurrentUniverseGame>;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

function normalizeRandomGameError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('Unable to resolve a random game.');
}

export function useRandomUniverseGame(
  universeId: string,
  mode: GameMode,
  accessToken: string | null,
): UseRandomUniverseGameResult {
  const [state, setState] = useState<CurrentUniverseGameState>({
    data: null,
    error: null,
    isLoading: true,
  });
  const [roundKey, setRoundKey] = useState(0);
  const activeRequestGenerationRef = useRef(0);
  const preloadedGameRef = useRef<PreloadedRandomGameState>({
    status: 'idle',
  });

  const loadRandomGame = useCallback(
    () => getRandomUniverseGame(universeId, mode, accessToken),
    [accessToken, mode, universeId],
  );

  const beginPreload = useCallback((requestGeneration: number) => {
    const promise = loadRandomGame();
    preloadedGameRef.current = {
      promise,
      status: 'loading',
    };

    void promise.then((data) => {
      if (activeRequestGenerationRef.current !== requestGeneration) {
        return;
      }

      preloadedGameRef.current = {
        data,
        status: 'ready',
      };
    }).catch((error: unknown) => {
      if (activeRequestGenerationRef.current !== requestGeneration) {
        return;
      }

      preloadedGameRef.current = {
        error: normalizeRandomGameError(error),
        status: 'error',
      };
    });
  }, [loadRandomGame]);

  const commitActiveGame = useCallback((data: CurrentUniverseGame, requestGeneration: number) => {
    if (activeRequestGenerationRef.current !== requestGeneration) {
      return;
    }

    setState({
      data,
      error: null,
      isLoading: false,
    });
    setRoundKey((currentValue) => currentValue + 1);
    beginPreload(requestGeneration);
  }, [beginPreload]);

  const resolveNextGame = useCallback(async (requestGeneration: number, consumePreloadedGame: boolean) => {
    setState({
      data: null,
      error: null,
      isLoading: true,
    });

    try {
      const nextGameRequest = consumePreloadedGame && preloadedGameRef.current.promise
        ? preloadedGameRef.current.promise
        : loadRandomGame();
      const data = await nextGameRequest;

      commitActiveGame(data, requestGeneration);
    } catch (error) {
      if (activeRequestGenerationRef.current !== requestGeneration) {
        return;
      }

      preloadedGameRef.current = {
        status: 'idle',
      };
      setState({
        data: null,
        error: normalizeRandomGameError(error),
        isLoading: false,
      });
    }
  }, [commitActiveGame, loadRandomGame]);

  useEffect(() => {
    const requestGeneration = activeRequestGenerationRef.current + 1;
    activeRequestGenerationRef.current = requestGeneration;
    preloadedGameRef.current = {
      status: 'idle',
    };

    void resolveNextGame(requestGeneration, false);
  }, [resolveNextGame]);

  const advanceToNextGame = useCallback(() => {
    const requestGeneration = activeRequestGenerationRef.current;
    const preloadedGame = preloadedGameRef.current;

    if (preloadedGame.status === 'ready' && preloadedGame.data) {
      commitActiveGame(preloadedGame.data, requestGeneration);
      return;
    }

    void resolveNextGame(requestGeneration, preloadedGame.status === 'loading');
  }, [commitActiveGame, resolveNextGame]);

  return {
    advanceToNextGame,
    roundKey,
    state,
  };
}
