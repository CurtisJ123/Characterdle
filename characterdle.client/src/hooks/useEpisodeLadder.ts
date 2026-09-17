import { useEffect, useRef, useState } from 'react';
import { ladderGuestId, migrateGuestLadderVictories, readLadderProgress, readLegacyLadderProgress, readLadderDifficultyStates, storeLadderProgress } from '../lib/episodeLadderProgress';
import { EpisodeLadderApiError, requestEpisodeLadder } from '../services/episodeLadderApi';
import type { EpisodeLadderGame } from '../types/episodeLadder';

export function useEpisodeLadder(gameId: number | null, userId: string | undefined, token: string | null, authLoading: boolean, difficulty = 1) {
  const [state, setState] = useState<{
    scope: string; game: EpisodeLadderGame | null; order: number[]; error: string | null; locked: boolean; submitting: boolean;
  }>({ scope: '', game: null, order: [], error: null, locked: false, submitting: false });
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const owner = userId ? `user:${userId}` : 'guest';
  const scope = `${gameId}:${difficulty}:${owner}:${token}:${revision}`;
  const loading = authLoading || state.scope !== scope;
  const game = loading ? null : state.game;
  const order = loading ? [] : state.order;

  function apply(next: EpisodeLadderGame) {
    storeLadderProgress(owner, next);
    setState({ scope, game: { ...next, difficulties: next.difficulties ?? readLadderDifficultyStates(owner, next.gameId) }, order: next.attempts.at(-1)?.order ?? next.initialOrder, error: null, locked: false, submitting: false });
  }

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    request.current = controller;
    busy.current = false;
    void (async () => {
      try {
        if (userId && token) await migrateGuestLadderVictories(userId, token);
        if (controller.signal.aborted) return;
        let next = await requestEpisodeLadder(gameId, token, controller.signal, undefined, difficulty);
        if (!userId) {
          const saved = readLadderProgress('guest', next.gameId, difficulty) ?? readLegacyLadderProgress('guest', next);
          if (saved?.attempts.length) {
            next = await requestEpisodeLadder(next.gameId, null, controller.signal,
              { attempts: saved.attempts, guestId: ladderGuestId() }, difficulty);
          }
        }
        if (controller.signal.aborted) return;
        storeLadderProgress(owner, next);
        setState({ scope, game: { ...next, difficulties: next.difficulties ?? readLadderDifficultyStates(owner, next.gameId) }, order: next.attempts.at(-1)?.order ?? next.initialOrder, error: null, locked: false, submitting: false });
      } catch (failure) {
        if (controller.signal.aborted) return;
        setState({ scope, game: null, order: [], submitting: false,
          locked: failure instanceof EpisodeLadderApiError && failure.status === 403,
          error: failure instanceof Error ? failure.message : 'Unable to load Episode Ladder.' });
      }
    })();
    return () => controller.abort();
  }, [gameId, difficulty, userId, token, authLoading, owner, scope]);

  async function submit() {
    if (!game || game.status !== 'playing' || busy.current || loading) return false;
    busy.current = true;
    setState(previous => ({ ...previous, submitting: true, error: null }));
    const controller = request.current!;
    try {
      const next = await requestEpisodeLadder(game.gameId, token, controller.signal, {
        attempts: [...game.attempts.map(attempt => attempt.order), order],
        ...(!userId ? { guestId: ladderGuestId() } : {}),
      }, difficulty);
      if (controller.signal.aborted) return false;
      apply(next);
      return true;
    } catch (failure) {
      if (controller.signal.aborted) return false;
      if (failure instanceof EpisodeLadderApiError && failure.current) apply(failure.current);
      setState(previous => ({ ...previous, error: failure instanceof Error ? failure.message : 'Your order could not be submitted. Try again.' }));
      return false;
    } finally {
      if (!controller.signal.aborted) { busy.current = false; setState(previous => ({ ...previous, submitting: false })); }
    }
  }

  return { game, order, setOrder: (next: number[]) => setState(previous => ({ ...previous, order: next })),
    difficulties: state.game?.difficulties ?? [],
    error: loading ? null : state.error, locked: !loading && state.locked, loading,
    submitting: !loading && state.submitting, submit, retry: () => setRevision(value => value + 1) };
}
