import { useEffect, useState } from 'react';
import { getProfile } from '../services/profileApi';
import type { ProfileState } from '../types/profile';

export function useProfile(accessToken: string | null, universeId: string): ProfileState {
  const [state, setState] = useState<Omit<ProfileState, 'reload'>>({
    data: null,
    error: null,
    isLoading: Boolean(accessToken),
  });

  async function loadProfile() {
    if (!accessToken) {
      setState({
        data: null,
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
      const data = await getProfile(accessToken, universeId);
      setState({
        data,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error('Unable to load profile data.'),
        isLoading: false,
      });
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!accessToken) {
        if (!isMounted) {
          return;
        }

        setState({
          data: null,
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
        const data = await getProfile(accessToken, universeId);

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
          error: error instanceof Error ? error : new Error('Unable to load profile data.'),
          isLoading: false,
        });
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [accessToken, universeId]);

  return {
    ...state,
    reload: loadProfile,
  };
}
