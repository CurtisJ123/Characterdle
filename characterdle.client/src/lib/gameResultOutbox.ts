import { submitUniverseGameResult } from '../services/leaderboardApi';
import type { SubmitUniverseGameResultPayload, UniverseStreak } from '../types/leaderboard';

const GAME_RESULT_OUTBOX_KEY_PREFIX = 'universe-game-result-outbox';
const GAME_RESULT_OUTBOX_VERSION = 1;

interface PendingGameResultSubmission {
  key: string;
  payload: SubmitUniverseGameResultPayload;
  queuedAt: string;
  revision: string;
}

interface StoredGameResultOutbox {
  entries: readonly PendingGameResultSubmission[];
  version: number;
}

export interface GameResultFlushOutcome {
  streak: UniverseStreak;
  universeId: string;
}

const activeFlushes = new Map<string, Promise<GameResultFlushOutcome[]>>();

function getOutboxStorageKey(userId: string): string {
  return `${GAME_RESULT_OUTBOX_KEY_PREFIX}:${userId}`;
}

function getSubmissionKey(payload: SubmitUniverseGameResultPayload): string {
  return `${payload.universeId}:${payload.gameId}:${payload.mode}`;
}

function createRevision(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizePayload(value: unknown): SubmitUniverseGameResultPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<SubmitUniverseGameResultPayload>;

  if (
    typeof candidate.universeId !== 'string'
    || !candidate.universeId.trim()
    || typeof candidate.gameId !== 'number'
    || !Number.isInteger(candidate.gameId)
    || candidate.gameId <= 0
    || (candidate.mode !== 'character' && candidate.mode !== 'quote')
    || (candidate.status !== 'playing' && candidate.status !== 'won' && candidate.status !== 'lost')
  ) {
    return null;
  }

  const guessedCharacterIds = Array.isArray(candidate.guessedCharacterIds)
    ? [...new Set(candidate.guessedCharacterIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
    : [];
  const revealedHintKeys = Array.isArray(candidate.revealedHintKeys)
    ? [...new Set(candidate.revealedHintKeys
      .filter((key): key is string => typeof key === 'string')
      .map((key) => key.trim())
      .filter((key) => key.length > 0 && key.length <= 100))].slice(0, 50)
    : [];

  return {
    gameId: candidate.gameId,
    guessCount: typeof candidate.guessCount === 'number' && candidate.guessCount >= 0
      ? Math.max(Math.floor(candidate.guessCount), guessedCharacterIds.length)
      : guessedCharacterIds.length,
    guessedCharacterIds,
    hintCount: revealedHintKeys.length,
    mode: candidate.mode,
    revealedHintKeys,
    status: candidate.status,
    universeId: candidate.universeId.trim(),
  };
}

function readOutbox(userId: string): PendingGameResultSubmission[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getOutboxStorageKey(userId));

    if (!rawValue) {
      return [];
    }

    const storedValue = JSON.parse(rawValue) as Partial<StoredGameResultOutbox>;

    if (storedValue.version !== GAME_RESULT_OUTBOX_VERSION || !Array.isArray(storedValue.entries)) {
      return [];
    }

    return storedValue.entries.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const candidate = entry as Partial<PendingGameResultSubmission>;
      const payload = normalizePayload(candidate.payload);

      if (!payload || typeof candidate.revision !== 'string' || !candidate.revision) {
        return [];
      }

      return [{
        key: getSubmissionKey(payload),
        payload,
        queuedAt: typeof candidate.queuedAt === 'string' && !Number.isNaN(Date.parse(candidate.queuedAt))
          ? candidate.queuedAt
          : new Date(0).toISOString(),
        revision: candidate.revision,
      }];
    });
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, entries: readonly PendingGameResultSubmission[]): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(getOutboxStorageKey(userId));
      return true;
    }

    window.localStorage.setItem(
      getOutboxStorageKey(userId),
      JSON.stringify({
        entries,
        version: GAME_RESULT_OUTBOX_VERSION,
      } satisfies StoredGameResultOutbox),
    );
    return true;
  } catch {
    return false;
  }
}

export function enqueueUniverseGameResult(
  userId: string,
  payload: SubmitUniverseGameResultPayload,
): boolean {
  const normalizedPayload = normalizePayload(payload);

  if (!userId.trim() || !normalizedPayload) {
    return false;
  }

  const entries = readOutbox(userId);
  const key = getSubmissionKey(normalizedPayload);
  const existingEntry = entries.find((entry) => entry.key === key);
  const nextEntry: PendingGameResultSubmission = {
    key,
    payload: normalizedPayload,
    queuedAt: existingEntry?.queuedAt ?? new Date().toISOString(),
    revision: createRevision(),
  };
  const nextEntries = [
    ...entries.filter((entry) => entry.key !== key),
    nextEntry,
  ];

  return writeOutbox(userId, nextEntries);
}

export function hasPendingUniverseGameResults(userId: string): boolean {
  return readOutbox(userId).length > 0;
}

export function clearUniverseGameResultOutbox(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(getOutboxStorageKey(userId));
  } catch {
    // Account deletion can continue even when browser storage is unavailable.
  }
}

function removeEntryIfCurrent(userId: string, submittedEntry: PendingGameResultSubmission): void {
  const currentEntries = readOutbox(userId);
  const currentEntry = currentEntries.find((entry) => entry.key === submittedEntry.key);

  if (!currentEntry || currentEntry.revision !== submittedEntry.revision) {
    return;
  }

  writeOutbox(
    userId,
    currentEntries.filter((entry) => entry.key !== submittedEntry.key),
  );
}

async function flushPersistedResults(
  userId: string,
  accessToken: string,
): Promise<GameResultFlushOutcome[]> {
  const pendingEntries = readOutbox(userId)
    .sort((left, right) => Date.parse(left.queuedAt) - Date.parse(right.queuedAt));
  const outcomes: GameResultFlushOutcome[] = [];
  let firstError: unknown = null;

  for (const entry of pendingEntries) {
    try {
      const streak = await submitUniverseGameResult(accessToken, entry.payload);
      removeEntryIfCurrent(userId, entry);
      outcomes.push({
        streak,
        universeId: entry.payload.universeId,
      });
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError) {
    throw firstError;
  }

  return outcomes;
}

export async function flushUniverseGameResultOutbox(
  userId: string,
  accessToken: string,
): Promise<GameResultFlushOutcome[]> {
  if (!userId.trim() || !accessToken.trim()) {
    return [];
  }

  const activeFlush = activeFlushes.get(userId);

  if (activeFlush) {
    const outcomes = await activeFlush;

    if (!hasPendingUniverseGameResults(userId)) {
      return outcomes;
    }

    return [
      ...outcomes,
      ...await flushUniverseGameResultOutbox(userId, accessToken),
    ];
  }

  const flushPromise = flushPersistedResults(userId, accessToken);
  activeFlushes.set(userId, flushPromise);

  try {
    return await flushPromise;
  } finally {
    if (activeFlushes.get(userId) === flushPromise) {
      activeFlushes.delete(userId);
    }
  }
}
