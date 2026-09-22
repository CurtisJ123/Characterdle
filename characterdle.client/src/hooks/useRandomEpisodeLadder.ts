import { useCallback, useEffect, useRef, useState } from 'react';
import { EpisodeLadderApiError, requestRandomLadder } from '../services/episodeLadderApi';
import type { RandomLadderRound } from '../types/episodeLadder';

export function useRandomEpisodeLadder(userId: string | undefined, token: string | null, authLoading: boolean, difficulty = 1) {
  const owner = `${userId}:${token}`;
  const scope = `${owner}:${difficulty}`;
  const [state, setState] = useState<{
    scope: string; round: RandomLadderRound | null; order: number[]; error: string | null;
    loading: boolean; submitting: boolean; locked: boolean; roundKey: number;
  }>({ scope: '', round: null, order: [], error: null, loading: true, submitting: false, locked: false, roundKey: 0 });
  const lifecycle = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const cache = useRef(new Map<number, { round: RandomLadderRound; order: number[] }>());
  const cacheOwner = useRef(owner);
  const preload = useRef<{ ready?: RandomLadderRound; promise?: Promise<RandomLadderRound | null> }>({});
  const loading = authLoading || state.scope !== scope || state.loading;

  const beginPreload = useCallback((controller: AbortController) => {
    const entry: typeof preload.current = {};
    preload.current = entry;
    entry.promise = requestRandomLadder(token, controller.signal, undefined, difficulty).then(round => {
      if (!controller.signal.aborted) entry.ready = round;
      return round;
    }).catch(() => null); // A failed speculative request must not interrupt the current round.
  }, [token, difficulty]);

  const commit = useCallback((round: RandomLadderRound, controller: AbortController, order = round.game.initialOrder) => {
    if (controller.signal.aborted) return;
    cache.current.set(difficulty, { round, order });
    const difficulties = [1, 2, 3, 4, 5].map(level => cache.current.get(level)?.round.game.status ?? 'pending');
    setState(previous => ({ scope, round: { ...round, game: { ...round.game, difficulties } }, order, error: null,
      loading: false, submitting: false, locked: false, roundKey: previous.roundKey + 1 }));
    beginPreload(controller);
  }, [scope, beginPreload, difficulty]);

  const fail = useCallback((failure: unknown) => {
    const locked = failure instanceof EpisodeLadderApiError && [401, 403].includes(failure.status);
    setState(previous => ({ ...previous, scope, loading: false, submitting: false, locked,
      ...(locked ? { round: null, order: [] } : {}),
      error: failure instanceof Error ? failure.message : 'Unable to load random Episode Ladder.' }));
    if (locked) preload.current = {};
  }, [scope]);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    if (cacheOwner.current !== owner) { cache.current.clear(); cacheOwner.current = owner; }
    lifecycle.current = controller;
    busy.current = false;
    preload.current = {};
    const saved = cache.current.get(difficulty);
    void (saved ? Promise.resolve(saved.round) : requestRandomLadder(token, controller.signal, undefined, difficulty))
      .then(round => commit(round, controller, saved?.order))
      .catch(failure => { if (!controller.signal.aborted) fail(failure); });
    return () => controller.abort();
  }, [token, owner, difficulty, authLoading, commit, fail]);

  async function nextGame() {
    const controller = lifecycle.current;
    if (!controller || controller.signal.aborted || busy.current || loading) return;
    busy.current = true;
    const queued = preload.current;
    preload.current = {};
    try {
      if (queued.ready) { commit(queued.ready, controller); return; }
      setState(previous => ({ ...previous, round: null, order: [], loading: true, error: null }));
      const round = (await queued.promise) ?? await requestRandomLadder(token, controller.signal, undefined, difficulty);
      commit(round, controller);
    } catch (failure) { if (!controller.signal.aborted) fail(failure); }
    finally { if (!controller.signal.aborted) busy.current = false; }
  }

  async function submit() {
    const controller = lifecycle.current;
    const round = state.round;
    if (!controller || controller.signal.aborted || !round || loading || busy.current || round.game.status !== 'playing') return false;
    busy.current = true;
    setState(previous => ({ ...previous, submitting: true, error: null }));
    try {
      const next = await requestRandomLadder(token, controller.signal, { roundToken: round.roundToken, order: state.order });
      if (controller.signal.aborted) return false;
      const order = next.game.attempts.at(-1)!.order;
      cache.current.set(difficulty, { round: next, order });
      next.game.difficulties = [1, 2, 3, 4, 5].map(level => cache.current.get(level)?.round.game.status ?? 'pending');
      setState(previous => ({ ...previous, round: next, order, submitting: false }));
      return true;
    } catch (failure) {
      if (!controller.signal.aborted) fail(failure);
      return false;
    } finally { if (!controller.signal.aborted) busy.current = false; }
  }

  // Deliberately memory-only: no daily progress, guest migration, or result outbox.
  return { game: loading ? null : state.round?.game ?? null, order: loading ? [] : state.order,
    difficulties: state.round?.game.difficulties ?? [],
    setOrder: (order: number[]) => {
      const saved = cache.current.get(difficulty);
      if (saved) cache.current.set(difficulty, { ...saved, order });
      setState(previous => ({ ...previous, order }));
    },
    error: loading ? null : state.error, locked: !loading && state.locked, loading,
    submitting: !loading && state.submitting, submit, retry: nextGame, nextGame, roundKey: state.roundKey };
}
