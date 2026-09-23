import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ladderGuestId, migrateGuestLadderVictories, readLadderDifficultyStates, storeLadderProgress } from '../lib/episodeLadderProgress';
import { ladderScope } from '../lib/episodeLadderCache';
import { EpisodeLadderApiError, requestEpisodeLadder } from '../services/episodeLadderApi';
import { beginLadderMutation, ladderCache, loadLadderGame } from '../services/episodeLadderLoader';
import type { EpisodeLadderGame } from '../types/episodeLadder';

export function useEpisodeLadder(gameId: number | null, userId: string | undefined, token: string | null,
  authLoading: boolean, difficulty = 1, fullArchiveAccess = false) {
  const owner = userId ? `user:${userId}` : 'guest';
  const scope = ladderScope(userId, fullArchiveAccess);
  const view = `${scope}:${gameId}:${difficulty}`;
  const snapshot = useSyncExternalStore(ladderCache.subscribe, () => ladderCache.peek(scope, gameId, difficulty), () => undefined);
  const [state, setState] = useState<{ view: string; error: string | null; locked: boolean; submitting: boolean;
    streak?: EpisodeLadderGame['streak'] }>({ view: '', error: null, locked: false, submitting: false });
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const currentState = state.view === view ? state : null;
  const loading = authLoading || (!snapshot && !currentState?.error);
  const game = authLoading || !snapshot ? null : currentState?.streak ? { ...snapshot.game, streak: currentState.streak } : snapshot.game;
  const order = snapshot?.order ?? [];

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const controller = new AbortController();
    request.current = controller;
    busy.current = false;
    async function refresh(force = false) {
      if (busy.current) return;
      try {
        if (userId && token) await migrateGuestLadderVictories(userId, token);
        if (cancelled || busy.current) return;
        const next = await loadLadderGame(scope, gameId, difficulty, token, { force });
        if (!cancelled) {
          storeLadderProgress(owner, next.game);
          setState(previous => ({ view, error: null, locked: false, submitting: false,
            streak: previous.view === view ? previous.streak : null }));
        }
      } catch (failure) {
        if (cancelled || (failure instanceof Error && failure.name === 'AbortError')) return;
        setState({ view, submitting: false,
          locked: failure instanceof EpisodeLadderApiError && [401, 403].includes(failure.status),
          error: failure instanceof Error ? failure.message : 'Unable to load Episode Ladder.' });
      }
    }
    void refresh();
    const revisit = () => {
      if (document.hidden) return;
      const cached = ladderCache.peek(scope, gameId, difficulty);
      void refresh(!cached || Date.now() - cached.receivedAt > 30_000);
    };
    const sync = () => { void refresh(true); };
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    window.addEventListener('focus', revisit);
    window.addEventListener('online', sync);
    window.addEventListener('ladder-progress-changed', sync);
    return () => {
      cancelled = true; controller.abort();
      if (busy.current) ladderCache.invalidate(scope, gameId, difficulty);
      window.clearInterval(interval);
      window.removeEventListener('focus', revisit);
      window.removeEventListener('online', sync);
      window.removeEventListener('ladder-progress-changed', sync);
    };
  }, [gameId, difficulty, userId, token, authLoading, owner, scope, view, revision]);

  function apply(next: EpisodeLadderGame) {
    storeLadderProgress(owner, next);
    if (!userId) next = { ...next, difficulties: readLadderDifficultyStates(owner, next.gameId) };
    ladderCache.set(scope, next);
    setState({ view, error: null, locked: false, submitting: false, streak: next.streak });
  }

  async function submit() {
    const controller = request.current;
    if (!controller || controller.signal.aborted || !game || game.status !== 'playing' || busy.current || loading) return false;
    busy.current = true;
    const finish = beginLadderMutation(scope, game.gameId, difficulty);
    setState({ view, submitting: true, error: null, locked: false });
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
      const locked = failure instanceof EpisodeLadderApiError && [401, 403].includes(failure.status);
      if (locked) ladderCache.invalidate(scope, gameId, difficulty);
      setState(previous => ({ ...previous, view, locked,
        error: failure instanceof Error ? failure.message : 'Your order could not be submitted. Try again.' }));
      return false;
    } finally {
      finish();
      if (!controller.signal.aborted) { busy.current = false; setState(previous => ({ ...previous, submitting: false })); }
    }
  }

  return { game, order, setOrder: (next: number[]) => { if (game) ladderCache.setOrder(scope, game.gameId, difficulty, next); },
    difficulties: snapshot?.game.difficulties ?? [], error: currentState?.error ?? null,
    locked: currentState?.locked ?? false, loading, submitting: currentState?.submitting ?? false, submit,
    retry: () => { ladderCache.invalidate(scope, gameId, difficulty); setRevision(value => value + 1); } };
}
