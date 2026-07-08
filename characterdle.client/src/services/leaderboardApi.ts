import type {
  SubmitUniverseGameResultPayload,
  UniverseLeaderboard,
  UniverseStreak,
} from '../types/leaderboard';
import { buildApiUrl } from '../lib/runtimeConfig';

const leaderboardRequests = new Map<string, Promise<UniverseLeaderboard>>();
const MAX_PERSISTED_GUESSES = 50;

function createLeaderboardCacheKey(universeId: string, requestScope: string): string {
  return `${universeId}:${requestScope}`;
}

export function clearLeaderboardCache(universeId?: string) {
  if (!universeId) {
    leaderboardRequests.clear();
    return;
  }

  for (const cacheKey of [...leaderboardRequests.keys()]) {
    if (cacheKey.startsWith(`${universeId}:`)) {
      leaderboardRequests.delete(cacheKey);
    }
  }
}

export function getLeaderboard(
  universeId: string,
  accessToken: string | null,
  requestScope: string,
): Promise<UniverseLeaderboard> {
  const cacheKey = createLeaderboardCacheKey(universeId, requestScope);
  const cachedRequest = leaderboardRequests.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchLeaderboard(universeId, accessToken).catch((error: unknown) => {
    leaderboardRequests.delete(cacheKey);
    throw error;
  });

  leaderboardRequests.set(cacheKey, request);
  return request;
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

async function fetchLeaderboard(universeId: string, accessToken: string | null): Promise<UniverseLeaderboard> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/leaderboard/`), {
    headers: accessToken
      ? {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      }
      : {
        Accept: 'application/json',
      },
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed with ${response.status}.`);
  }

  return await response.json() as UniverseLeaderboard;
}
