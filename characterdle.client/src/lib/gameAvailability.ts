import type { GameMode } from '../types/game';

export function gameAvailabilityPath(universeId: string, gameId: number, mode: GameMode): string {
  return `/api/universes/${encodeURIComponent(universeId)}/games/${gameId}/availability/${mode}`;
}

export async function fetchGameAvailability(url: string, signal: AbortSignal, fetchPublic = fetch): Promise<boolean> {
  const response = await fetchPublic(url, {
    headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'manual', signal,
  });
  // A missing endpoint (e.g. an older backend deployment) is NOT a missing game.
  if (!response.ok) throw new Error('Game availability request failed.');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('available' in data) || typeof data.available !== 'boolean') {
    throw new Error('Invalid game availability response.');
  }
  return data.available;
}
