import { useEffect, useState } from 'react';
import { getUniverseCharacterAvatarOptions } from '../services/universeGameApi';
import type { UniverseCharacterOption } from '../types/universeGame';

interface UniverseCharacterOptionsState {
  data: UniverseCharacterOption[];
  error: Error | null;
  isLoading: boolean;
}

export function useUniverseCharacterOptions(universeId: string): UniverseCharacterOptionsState {
  const [state, setState] = useState<UniverseCharacterOptionsState>({
    data: [],
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: true,
    }));

    async function load() {
      try {
        const data = await getUniverseCharacterAvatarOptions(universeId);

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
          error: error instanceof Error ? error : new Error('Unable to load character portraits.'),
          isLoading: false,
        });
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [universeId]);

  return state;
}
