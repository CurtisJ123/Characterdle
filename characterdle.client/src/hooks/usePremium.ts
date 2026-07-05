import { useEffect, useState } from 'react';
import { getPremiumState } from '../services/premiumApi';
import type { PremiumStateResult } from '../types/premium';

export function usePremium(accessToken: string | null): PremiumStateResult {
  const [state, setState] = useState<Omit<PremiumStateResult, 'reload'>>({
    data: null,
    error: null,
    isLoading: Boolean(accessToken),
  });

  async function loadPremiumState() {
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
      const data = await getPremiumState(accessToken);
      setState({
        data,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error('Unable to load premium access.'),
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
        const data = await getPremiumState(accessToken);

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
          error: error instanceof Error ? error : new Error('Unable to load premium access.'),
          isLoading: false,
        });
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  return {
    ...state,
    reload: loadPremiumState,
  };
}
