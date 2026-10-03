import type {
  SubmitUniverseGameResultPayload,
  UniverseLeaderboard,
  UniverseStreak,
} from '../types/leaderboard';
import { buildApiUrl } from '../lib/runtimeConfig';
import { clearEpisodeLadderLeaderboardCache } from './episodeLadderLeaderboardApi';
import { leaderboardHeaders, leaderboardScope } from '../lib/guestIdentity';
import { LeaderboardResource } from '../lib/leaderboardResource';

export const leaderboardResource = new LeaderboardResource<UniverseLeaderboard>();
const MAX_PERSISTED_GUESSES = 50;

export const leaderboardCacheKey = (universeId: string, token: string | null, scope: string) =>
  JSON.stringify([universeId, leaderboardScope(token, scope)]);

export function clearLeaderboardCache(universeId?: string) {
  clearEpisodeLadderLeaderboardCache(universeId);
  leaderboardResource.clear(key => !universeId || (JSON.parse(key) as string[])[0] === universeId);
}

export function getLeaderboard(
  universeId: string,
  accessToken: string | null,
  requestScope: string,
): Promise<UniverseLeaderboard> {
  return leaderboardResource.load(leaderboardCacheKey(universeId, accessToken, requestScope),
    signal => fetchLeaderboard(universeId, accessToken, signal));
}

export async function submitUniverseGameResult(
  accessToken: string,
  payload: SubmitUniverseGameResultPayload,
): Promise<UniverseStreak> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(payload.universeId)}/leaderboard/results`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      attemptNumber: payload.attemptNumber ?? 0,
      gameId: payload.gameId,
      guessCount: payload.guessCount,
      guessedCharacterIds: retainGuessesForPersistence(payload.guessedCharacterIds),
      hintCount: payload.hintCount,
      mode: payload.mode,
      revealedHintKeys: payload.revealedHintKeys,
      status: payload.status,
    }),
  });

  if (!response.ok) {
    throw new Error(`Leaderboard submission failed with ${response.status}.`);
  }

  clearLeaderboardCache(payload.universeId);
  return await response.json() as UniverseStreak;
}

export function retainGuessesForPersistence(guessedCharacterIds: readonly number[]): number[] {
  if (guessedCharacterIds.length <= MAX_PERSISTED_GUESSES) {
    return [...guessedCharacterIds];
  }

  const firstGuess = guessedCharacterIds[guessedCharacterIds.length - 1];
  return [...guessedCharacterIds.slice(0, MAX_PERSISTED_GUESSES - 1), firstGuess];
}

async function fetchLeaderboard(universeId: string, accessToken: string | null, signal: AbortSignal): Promise<UniverseLeaderboard> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/leaderboard/`), {
    headers: leaderboardHeaders(accessToken), cache: 'no-store', signal,
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed with ${response.status}.`);
  }

  return await response.json() as UniverseLeaderboard;
}
