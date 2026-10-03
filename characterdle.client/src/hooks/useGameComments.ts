import { useEffect, useRef, useState } from 'react';
import { flushUniverseGameResultOutbox } from '../lib/gameResultOutbox';
import { GameCommentsApiError, getGameComments, postGameComment, type GameCommentsScope } from '../services/gameCommentsApi';
import type { GameCommentsPage } from '../types/gameComments';
import { useCommentRefresh } from './useCommentRefresh';

export function useGameComments(accessToken: string, userId: string, scope: GameCommentsScope) {
  const { universeId, gameId, mode } = scope;
  const [pageNumber, setPageNumber] = useState(1);
  const [reload, setReload] = useState(0);
  const requestKey = JSON.stringify([accessToken, userId, universeId, gameId, mode, pageNumber]);
  const [result, setResult] = useState<{ key: string; data: GameCommentsPage } | null>(null);
  const data = result?.key === requestKey ? result.data : null;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const postingRef = useRef(false);
  useCommentRefresh(() => { if (!postingRef.current) setReload(value => value + 1); }, !isPosting && !isLoading);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    async function load() {
      setIsLoading(true);
      setIsPosting(false);
      setError(null);

      try {
        // The game page queues its final result in an effect. Wait for that durable save before reading.
        try {
          await flushUniverseGameResultOutbox(userId, accessToken);
        } catch (saveError) {
          console.warn('Game results are still waiting to sync.', saveError);
        }

        if (controller.signal.aborted) {
          return;
        }

        const result = await getGameComments(accessToken, { universeId, gameId, mode }, pageNumber, controller.signal);
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data: result });
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load comments.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessToken, userId, universeId, gameId, mode, pageNumber, reload, requestKey]);

  async function post(body: string): Promise<boolean> {
    const controller = controllerRef.current;
    if (!data || postingRef.current || !controller || controller.signal.aborted) {
      return false;
    }

    postingRef.current = true;
    setIsPosting(true);
    setError(null);
    try {
      await postGameComment(accessToken, scope, body, controller.signal);
      if (controller.signal.aborted) {
        return false;
      }

      // Keep the reader's page and oldest-first ordering when refreshing after a successful post.
      setReload(value => value + 1);
      return true;
    } catch (postError) {
      if (!controller.signal.aborted) {
        setError(postError instanceof Error ? postError.message : 'Unable to post your comment.');
        if (postError instanceof GameCommentsApiError && (postError.status === 401 || postError.status === 403)) {
          setResult(null);
        }
      }
      return false;
    } finally {
      postingRef.current = false;
      if (!controller.signal.aborted) {
        setIsPosting(false);
      }
    }
  }

  return {
    data, error, isLoading: isLoading && !data, isPosting, post,
    retry: () => setReload(value => value + 1),
    previous: () => {
      setResult(null);
      setIsLoading(true);
      setPageNumber(value => Math.max(1, value - 1));
    },
    next: () => {
      setResult(null);
      setIsLoading(true);
      setPageNumber(value => value + 1);
    },
  };
}
