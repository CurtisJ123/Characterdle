import type {
  SubmitUniverseGameResultPayload,
  UniverseLeaderboard,
} from '../types/leaderboard';

const leaderboardRequests = new Map<string, Promise<UniverseLeaderboard>>();

function createLeaderboardCacheKey(universeId: string, currentUserId: string | null): string {
  return `${universeId}:${currentUserId ?? 'guest'}`;
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

export function getLeaderboard(universeId: string, currentUserId: string | null): Promise<UniverseLeaderboard> {
  const cacheKey = createLeaderboardCacheKey(universeId, currentUserId);
  const cachedRequest = leaderboardRequests.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchLeaderboard(universeId, currentUserId).catch((error: unknown) => {
    leaderboardRequests.delete(cacheKey);
    throw error;
  });

  leaderboardRequests.set(cacheKey, request);
  return request;
}

export async function submitUniverseGameResult(
  accessToken: string,
  payload: SubmitUniverseGameResultPayload,
): Promise<void> {
  const response = await fetch(`/api/universes/${encodeURIComponent(payload.universeId)}/leaderboard/results`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      gameId: payload.gameId,
      guessCount: payload.guessCount,
      hintCount: payload.hintCount,
      mode: payload.mode,
      status: payload.status,
    }),
  });

  if (!response.ok) {
    throw new Error(`Leaderboard submission failed with ${response.status}.`);
  }

  clearLeaderboardCache(payload.universeId);
}

async function fetchLeaderboard(universeId: string, currentUserId: string | null): Promise<UniverseLeaderboard> {
  const query = currentUserId
    ? `?currentUserId=${encodeURIComponent(currentUserId)}`
    : '';
  const response = await fetch(`/api/universes/${encodeURIComponent(universeId)}/leaderboard/${query}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed with ${response.status}.`);
  }

  return await response.json() as UniverseLeaderboard;
}
