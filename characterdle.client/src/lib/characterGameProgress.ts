interface StoredGameStats {
  guessCounts: number[];
}

interface StoredCompletionState {
  completionRecorded?: boolean;
  gaveUp?: boolean;
}

const PLAY_STATS_STORAGE_KEY_PREFIX = 'character-game-stats';
const GAME_STATE_STORAGE_KEY_PREFIX = 'character-game-state';
const LEGACY_SESSION_STORAGE_KEY_PREFIX = 'character-game';
const QUOTE_PLAY_STATS_STORAGE_KEY_PREFIX = 'quote-game-stats';
const QUOTE_GAME_STATE_STORAGE_KEY_PREFIX = 'quote-game-state';

export function getCharacterGameStorageKey(universeId: string, gameId: number): string {
  return `${GAME_STATE_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getLegacyCharacterGameSessionStorageKey(universeId: string, gameId: number): string {
  return `${LEGACY_SESSION_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getCharacterGameStatsStorageKey(universeId: string, gameId: number): string {
  return `${PLAY_STATS_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getQuoteGameStorageKey(universeId: string, gameId: number): string {
  return `${QUOTE_GAME_STATE_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getQuoteGameStatsStorageKey(universeId: string, gameId: number): string {
  return `${QUOTE_PLAY_STATS_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

function readGuessCounts(storageKey: string): number[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

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

function readCompletionState(storageKey: string, fallbackStorageKey?: string): StoredCompletionState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  function parse(rawValue: string | null): StoredCompletionState | null {
    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as StoredCompletionState;
      return {
        completionRecorded: parsedValue.completionRecorded === true,
        gaveUp: parsedValue.gaveUp === true,
      };
    } catch {
      return null;
    }
  }

  return parse(window.localStorage.getItem(storageKey))
    ?? (fallbackStorageKey ? parse(window.sessionStorage.getItem(fallbackStorageKey)) : null);
}

export function readCharacterGameGuessCounts(universeId: string, gameId: number): number[] {
  return readGuessCounts(getCharacterGameStatsStorageKey(universeId, gameId));
}

export function readQuoteGameGuessCounts(universeId: string, gameId: number): number[] {
  return readGuessCounts(getQuoteGameStatsStorageKey(universeId, gameId));
}

export function hasCompletedCharacterGame(universeId: string, gameId: number): boolean {
  const storedState = readCompletionState(
    getCharacterGameStorageKey(universeId, gameId),
    getLegacyCharacterGameSessionStorageKey(universeId, gameId),
  );

  return storedState?.completionRecorded === true || storedState?.gaveUp === true;
}

export function hasCompletedQuoteGame(universeId: string, gameId: number): boolean {
  const storedState = readCompletionState(getQuoteGameStorageKey(universeId, gameId));
  return storedState?.completionRecorded === true || storedState?.gaveUp === true;
}
