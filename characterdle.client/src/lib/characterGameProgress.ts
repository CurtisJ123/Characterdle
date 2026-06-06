interface StoredGameStats {
  guessCounts: number[];
}

interface StoredCompletionState {
  completionRecorded?: boolean;
  gaveUp?: boolean;
  resolvedAt?: string | null;
}

export type StoredGameOutcome = 'pending' | 'won' | 'lost';

const PLAY_STATS_STORAGE_KEY_PREFIX = 'character-game-stats';
const GAME_STATE_STORAGE_KEY_PREFIX = 'character-game-state';
const LEGACY_SESSION_STORAGE_KEY_PREFIX = 'character-game';
const QUOTE_PLAY_STATS_STORAGE_KEY_PREFIX = 'quote-game-stats';
const QUOTE_GAME_STATE_STORAGE_KEY_PREFIX = 'quote-game-state';
const GIVE_UP_RESET_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
      const resolvedAt = typeof parsedValue.resolvedAt === 'string' && !Number.isNaN(Date.parse(parsedValue.resolvedAt))
        ? parsedValue.resolvedAt
        : null;

      if (parsedValue.gaveUp === true && hasExpiredGiveUp(resolvedAt)) {
        return null;
      }

      return {
        completionRecorded: parsedValue.completionRecorded === true,
        gaveUp: parsedValue.gaveUp === true,
        resolvedAt,
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

export function hasExpiredGiveUp(resolvedAt: string | null | undefined): boolean {
  if (!resolvedAt) {
    return false;
  }

  const resolvedAtMs = Date.parse(resolvedAt);

  if (Number.isNaN(resolvedAtMs)) {
    return false;
  }

  return Date.now() - resolvedAtMs >= GIVE_UP_RESET_WINDOW_MS;
}

export function getRemoteGameOutcome(
  status: 'lost' | 'won',
  completedAt: string,
): StoredGameOutcome {
  return status === 'lost' && hasExpiredGiveUp(completedAt)
    ? 'pending'
    : status;
}

export function getCharacterGameOutcome(universeId: string, gameId: number): StoredGameOutcome {
  const storedState = readCompletionState(
    getCharacterGameStorageKey(universeId, gameId),
    getLegacyCharacterGameSessionStorageKey(universeId, gameId),
  );

  if (storedState?.completionRecorded === true) {
    return 'won';
  }

  if (storedState?.gaveUp === true) {
    return 'lost';
  }

  return 'pending';
}

export function getQuoteGameOutcome(universeId: string, gameId: number): StoredGameOutcome {
  const storedState = readCompletionState(getQuoteGameStorageKey(universeId, gameId));

  if (storedState?.completionRecorded === true) {
    return 'won';
  }

  if (storedState?.gaveUp === true) {
    return 'lost';
  }

  return 'pending';
}
