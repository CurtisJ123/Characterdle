import type { PersistedGameResult } from '../types/profile';
import type { GameMode } from '../types/game';
import type { SubmitUniverseGameResultPayload } from '../types/leaderboard';
import { enqueueUniverseGameResult } from './gameResultOutbox';

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
const UNIVERSE_GAME_RESULTS_CACHE_KEY_PREFIX = 'universe-game-results';
const GIVE_UP_RESET_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface GuestVictoryState {
  completionRecorded?: boolean;
  firstLetterRevealed?: boolean;
  guessCount?: number;
  guessedCharacterIds?: unknown;
  revealedHintKeys?: unknown;
}

interface GuestVictoryMigrationCandidate {
  gameId: number;
  mode: GameMode;
  sourceStorageKey: string;
  state: GuestVictoryState;
  universeId: string;
}

export function getGameProgressOwnerKey(userId: string | null | undefined): string {
  return userId ? `user:${userId}` : 'guest';
}

export function getCharacterGameStorageKey(
  ownerKey: string,
  universeId: string,
  gameId: number,
): string {
  return `${GAME_STATE_STORAGE_KEY_PREFIX}:${ownerKey}:${universeId}:${gameId}`;
}

export function getLegacyCharacterGameSessionStorageKey(
  ownerKey: string,
  universeId: string,
  gameId: number,
): string {
  return `${LEGACY_SESSION_STORAGE_KEY_PREFIX}:${ownerKey}:${universeId}:${gameId}`;
}

export function getCharacterGameStatsStorageKey(universeId: string, gameId: number): string {
  return `${PLAY_STATS_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getQuoteGameStorageKey(
  ownerKey: string,
  universeId: string,
  gameId: number,
): string {
  return `${QUOTE_GAME_STATE_STORAGE_KEY_PREFIX}:${ownerKey}:${universeId}:${gameId}`;
}

export function getQuoteGameStatsStorageKey(universeId: string, gameId: number): string {
  return `${QUOTE_PLAY_STATS_STORAGE_KEY_PREFIX}:${universeId}:${gameId}`;
}

export function getUniverseGameResultsCacheKey(ownerKey: string, universeId: string): string {
  return `${UNIVERSE_GAME_RESULTS_CACHE_KEY_PREFIX}:${ownerKey}:${universeId}`;
}

function readGuestVictoryCandidates(): GuestVictoryMigrationCandidate[] {
  if (typeof window === 'undefined') {
    return [];
  }

  let storageKeys: string[];

  try {
    storageKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => key !== null);
  } catch {
    return [];
  }
  const storagePrefixes: Array<{ mode: GameMode; prefix: string }> = [
    { mode: 'character', prefix: `${GAME_STATE_STORAGE_KEY_PREFIX}:guest:` },
    { mode: 'quote', prefix: `${QUOTE_GAME_STATE_STORAGE_KEY_PREFIX}:guest:` },
  ];
  const candidates: GuestVictoryMigrationCandidate[] = [];

  for (const storageKey of storageKeys) {
    const matchingPrefix = storagePrefixes.find(({ prefix }) => storageKey.startsWith(prefix));

    if (!matchingPrefix) {
      continue;
    }

    const keySuffix = storageKey.slice(matchingPrefix.prefix.length);
    const separatorIndex = keySuffix.lastIndexOf(':');

    if (separatorIndex <= 0) {
      continue;
    }

    const universeId = keySuffix.slice(0, separatorIndex).trim();
    const gameId = Number(keySuffix.slice(separatorIndex + 1));

    if (!universeId || !Number.isSafeInteger(gameId) || gameId <= 0) {
      continue;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      const state = rawValue ? JSON.parse(rawValue) as GuestVictoryState : null;

      if (!state || state.completionRecorded !== true) {
        continue;
      }

      candidates.push({
        gameId,
        mode: matchingPrefix.mode,
        sourceStorageKey: storageKey,
        state,
        universeId,
      });
    } catch {
      // Leave malformed guest data untouched rather than deleting recoverable browser state.
    }
  }

  return candidates;
}

function buildGuestVictoryPayload(
  candidate: GuestVictoryMigrationCandidate,
): SubmitUniverseGameResultPayload {
  const guessedCharacterIds = Array.isArray(candidate.state.guessedCharacterIds)
    ? candidate.state.guessedCharacterIds.filter((id): id is number => Number.isInteger(id) && id > 0)
    : [];
  const revealedHintKeys = Array.isArray(candidate.state.revealedHintKeys)
    ? candidate.state.revealedHintKeys.filter((key): key is string => typeof key === 'string' && key.trim().length > 0)
    : [];

  if (candidate.state.firstLetterRevealed === true && !revealedHintKeys.includes('first-letter')) {
    revealedHintKeys.push('first-letter');
  }

  return {
    gameId: candidate.gameId,
    guessCount: typeof candidate.state.guessCount === 'number' && candidate.state.guessCount >= 0
      ? Math.max(Math.floor(candidate.state.guessCount), guessedCharacterIds.length)
      : guessedCharacterIds.length,
    guessedCharacterIds,
    hintCount: revealedHintKeys.length,
    mode: candidate.mode,
    revealedHintKeys,
    status: 'won',
    universeId: candidate.universeId,
  };
}

export function migrateGuestGameVictoriesToUser(userId: string): number {
  if (typeof window === 'undefined' || !userId.trim()) {
    return 0;
  }

  const ownerKey = getGameProgressOwnerKey(userId);
  let migratedCount = 0;

  for (const candidate of readGuestVictoryCandidates()) {
    const payload = buildGuestVictoryPayload(candidate);

    if (!enqueueUniverseGameResult(userId, payload)) {
      continue;
    }

    const targetStorageKey = candidate.mode === 'quote'
      ? getQuoteGameStorageKey(ownerKey, candidate.universeId, candidate.gameId)
      : getCharacterGameStorageKey(ownerKey, candidate.universeId, candidate.gameId);

    try {
      const existingTargetValue = window.localStorage.getItem(targetStorageKey);
      let targetAlreadyCompleted = false;

      if (existingTargetValue) {
        try {
          const existingTargetState = JSON.parse(existingTargetValue) as GuestVictoryState;
          targetAlreadyCompleted = existingTargetState.completionRecorded === true;
        } catch {
          // A valid guest victory can replace malformed account-scoped progress.
        }
      }

      if (!targetAlreadyCompleted) {
        const sourceValue = window.localStorage.getItem(candidate.sourceStorageKey);

        if (!sourceValue) {
          continue;
        }

        window.localStorage.setItem(targetStorageKey, sourceValue);
      }

      window.localStorage.removeItem(candidate.sourceStorageKey);
      migratedCount += 1;
    } catch {
      // Keep the guest copy so migration can be attempted again on the next session refresh.
    }
  }

  return migratedCount;
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
  status: 'playing' | 'lost' | 'won',
  completedAt: string | null,
): StoredGameOutcome {
  if (status === 'playing') {
    return 'pending';
  }

  return status === 'lost' && hasExpiredGiveUp(completedAt)
    ? 'pending'
    : status;
}

export function getCharacterGameOutcome(
  ownerKey: string,
  universeId: string,
  gameId: number,
): StoredGameOutcome {
  const storedState = readCompletionState(
    getCharacterGameStorageKey(ownerKey, universeId, gameId),
    getLegacyCharacterGameSessionStorageKey(ownerKey, universeId, gameId),
  );

  if (storedState?.completionRecorded === true) {
    return 'won';
  }

  if (storedState?.gaveUp === true) {
    return 'lost';
  }

  return 'pending';
}

export function getQuoteGameOutcome(
  ownerKey: string,
  universeId: string,
  gameId: number,
): StoredGameOutcome {
  const storedState = readCompletionState(getQuoteGameStorageKey(ownerKey, universeId, gameId));

  if (storedState?.completionRecorded === true) {
    return 'won';
  }

  if (storedState?.gaveUp === true) {
    return 'lost';
  }

  return 'pending';
}

function isPersistedGameStatus(value: unknown): value is PersistedGameResult['status'] {
  return value === 'playing' || value === 'won' || value === 'lost';
}

function readResolvedTimestamp(result: Pick<PersistedGameResult, 'completedAt' | 'updatedAt'>): string | null {
  const completedAt = typeof result.completedAt === 'string' && !Number.isNaN(Date.parse(result.completedAt))
    ? result.completedAt
    : null;

  if (completedAt) {
    return completedAt;
  }

  return typeof result.updatedAt === 'string' && !Number.isNaN(Date.parse(result.updatedAt))
    ? result.updatedAt
    : null;
}

function normalizePersistedGameResult(value: unknown): PersistedGameResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PersistedGameResult>;

  if (
    typeof candidate.gameId !== 'number'
    || (candidate.mode !== 'character' && candidate.mode !== 'quote')
    || !isPersistedGameStatus(candidate.status)
  ) {
    return null;
  }

  const guessedCharacterIds = Array.isArray(candidate.guessedCharacterIds)
    ? candidate.guessedCharacterIds.filter((entry): entry is number => typeof entry === 'number')
    : [];
  const revealedHintKeys = Array.isArray(candidate.revealedHintKeys)
    ? candidate.revealedHintKeys.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const completedAt = typeof candidate.completedAt === 'string' && !Number.isNaN(Date.parse(candidate.completedAt))
    ? candidate.completedAt
    : null;
  const updatedAt = typeof candidate.updatedAt === 'string' && !Number.isNaN(Date.parse(candidate.updatedAt))
    ? candidate.updatedAt
    : new Date(0).toISOString();

  return {
    completedAt,
    gameId: candidate.gameId,
    guessCount: typeof candidate.guessCount === 'number' && candidate.guessCount >= 0
      ? Math.max(candidate.guessCount, guessedCharacterIds.length)
      : guessedCharacterIds.length,
    guessedCharacterIds,
    hintCount: typeof candidate.hintCount === 'number' && candidate.hintCount >= 0
      ? candidate.hintCount
      : 0,
    mode: candidate.mode,
    revealedHintKeys,
    status: candidate.status,
    updatedAt,
  };
}

export function readCachedUniverseGameResults(ownerKey: string, universeId: string): PersistedGameResult[] {
  if (typeof window === 'undefined' || ownerKey === 'guest') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getUniverseGameResultsCacheKey(ownerKey, universeId));

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as { results?: unknown };

    if (!Array.isArray(parsedValue.results)) {
      return [];
    }

    return parsedValue.results
      .map((entry) => normalizePersistedGameResult(entry))
      .filter((entry): entry is PersistedGameResult => entry !== null);
  } catch {
    return [];
  }
}

export function cacheUniverseGameResults(
  ownerKey: string,
  universeId: string,
  results: readonly PersistedGameResult[],
): void {
  if (typeof window === 'undefined' || ownerKey === 'guest') {
    return;
  }

  try {
    window.localStorage.setItem(
      getUniverseGameResultsCacheKey(ownerKey, universeId),
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        results,
      }),
    );
  } catch {
    // Ignore local storage failures and keep the in-memory response.
  }
}

export function syncPersistedGameResultsToLocalProgress(
  ownerKey: string,
  universeId: string,
  results: readonly PersistedGameResult[],
): void {
  if (typeof window === 'undefined' || ownerKey === 'guest') {
    return;
  }

  for (const result of results) {
    const storageKey = result.mode === 'quote'
      ? getQuoteGameStorageKey(ownerKey, universeId, result.gameId)
      : getCharacterGameStorageKey(ownerKey, universeId, result.gameId);

    const nextState = {
      completionRecorded: result.status === 'won',
      firstLetterRevealed: result.revealedHintKeys.includes('first-letter'),
      gaveUp: result.status === 'lost',
      guessCount: Math.max(result.guessCount, result.guessedCharacterIds.length),
      guessedCharacterIds: result.guessedCharacterIds,
      resolvedAt: readResolvedTimestamp(result),
      revealedHintKeys: result.revealedHintKeys.filter((key) => key !== 'first-letter'),
      updatedAt: typeof result.updatedAt === 'string' && !Number.isNaN(Date.parse(result.updatedAt))
        ? result.updatedAt
        : new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    } catch {
      // Ignore local storage failures so game state still loads from the API response.
    }
  }
}
