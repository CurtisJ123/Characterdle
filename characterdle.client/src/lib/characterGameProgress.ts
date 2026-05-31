interface StoredGameStats {
  guessCounts: number[];
}

const PLAY_STATS_STORAGE_KEY_PREFIX = 'character-game-stats';
const GAME_STATE_STORAGE_KEY_PREFIX = 'character-game-state';
const LEGACY_SESSION_STORAGE_KEY_PREFIX = 'character-game';

export function getCharacterGameStorageKey(universeId: string, gameId: number): string {
  return `${GAME_STATE_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getLegacyCharacterGameSessionStorageKey(universeId: string, gameId: number): string {
  return `${LEGACY_SESSION_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getCharacterGameStatsStorageKey(universeId: string, gameId: number): string {
  return `${PLAY_STATS_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function readCharacterGameGuessCounts(universeId: string, gameId: number): number[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getCharacterGameStatsStorageKey(universeId, gameId));

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredGameStats>;
    return Array.isArray(parsedValue.guessCounts)
      ? parsedValue.guessCounts.filter((value) => typeof value === 'number' && value > 0)
      : [];
  } catch {
    return [];
  }
}

export function hasCompletedCharacterGame(universeId: string, gameId: number): boolean {
  return readCharacterGameGuessCounts(universeId, gameId).length > 0;
}
