import { buildApiUrl } from '../lib/runtimeConfig';
import type { EpisodeLadderGame, RandomLadderRound } from '../types/episodeLadder';

export class EpisodeLadderApiError extends Error {
  readonly status: number;
  readonly current?: EpisodeLadderGame;
  constructor(status: number, message: string, current?: EpisodeLadderGame) {
    super(message);
    this.status = status;
    this.current = current;
  }
}

export async function requestEpisodeLadder(
  gameId: number | null,
  token: string | null,
  signal?: AbortSignal,
  submission?: { attempts: number[][]; guestId?: string; importGuest?: boolean },
  difficulty = 1,
): Promise<EpisodeLadderGame> {
  const suffix = submission ? (submission.importGuest ? '/import' : '/attempts') : '';
  const response = await fetch(buildApiUrl(`/api/universes/got/episode-ladder/${gameId ?? 'current'}${suffix}?difficulty=${difficulty}`), {
    method: submission ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(submission ? { 'Content-Type': 'application/json' } : {}),
    },
    body: submission ? JSON.stringify({ attempts: submission.attempts, guestId: submission.guestId, difficulty }) : undefined,
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; title?: string; current?: EpisodeLadderGame };
    throw new EpisodeLadderApiError(response.status,
      payload.message ?? payload.title ?? 'Unable to load Episode Ladder. Please try again.', payload.current);
  }
  return await response.json() as EpisodeLadderGame;
}

export async function requestRandomLadder(token: string | null, signal: AbortSignal,
  submission?: { roundToken: string; order: number[] }, difficulty = 1): Promise<RandomLadderRound> {
  const response = await fetch(buildApiUrl(`/api/universes/got/episode-ladder/random${submission ? '/attempts' : ''}?difficulty=${difficulty}`), {
    method: submission ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(submission ? { 'Content-Type': 'application/json' } : {}) },
    body: submission ? JSON.stringify(submission) : undefined,
    cache: 'no-store', signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; title?: string };
    throw new EpisodeLadderApiError(response.status, payload.message ?? payload.title ?? 'Unable to load random Episode Ladder.');
  }
  return await response.json() as RandomLadderRound;
}
