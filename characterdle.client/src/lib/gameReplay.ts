const REPLAY_WAIT_MS = 30 * 24 * 60 * 60 * 1000;

export type ArchiveGameOutcome = 'pending' | 'won' | 'won-with-hints' | 'lost';

export interface ReplayProgress {
  attemptNumber?: number;
  completionRecorded?: boolean;
  gaveUp?: boolean;
  firstLetterRevealed?: boolean;
  guessCount?: number;
  guessedCharacterIds?: number[];
  revealedHintKeys?: string[];
  hintCount?: number;
  resolvedAt?: string | null;
  updatedAt?: string | null;
}

export function getAttemptNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function isReplayAvailable(
  status: string,
  hintCount: number,
  completedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  return (status === 'lost' || (status === 'won' && hintCount > 0))
    && !!completedAt
    && now - Date.parse(completedAt) >= REPLAY_WAIT_MS;
}

export function getProgressHintCount(state: ReplayProgress): number {
  return Math.max(state.hintCount ?? 0,
    (state.revealedHintKeys?.length ?? 0) + (state.firstLetterRevealed ? 1 : 0));
}

export function getArchiveGameOutcome(
  status: string,
  hintCount: number,
  completedAt: string | null | undefined,
  now = Date.now(),
): ArchiveGameOutcome {
  if (status === 'playing' || isReplayAvailable(status, hintCount, completedAt, now)) return 'pending';
  if (status === 'won') return hintCount > 0 ? 'won-with-hints' : 'won';
  return status === 'lost' ? 'lost' : 'pending';
}

export function prepareReplayProgress<T extends ReplayProgress>(state: T, now = Date.now()): T {
  const attemptNumber = getAttemptNumber(state.attemptNumber);
  const status = state.completionRecorded ? 'won' : state.gaveUp ? 'lost' : 'playing';
  if (!isReplayAvailable(status, getProgressHintCount(state), state.resolvedAt, now)) {
    return { ...state, attemptNumber };
  }

  return {
    ...state,
    attemptNumber: attemptNumber + 1,
    completionRecorded: false,
    gaveUp: false,
    firstLetterRevealed: false,
    guessCount: 0,
    guessedCharacterIds: [],
    revealedHintKeys: [],
    hintCount: 0,
    resolvedAt: null,
  };
}

// Compare the attempt before its progress: an old victory must not replace a replay.
export function mergeReplayProgress<T extends ReplayProgress>(local: T, remote: T): T {
  const left = prepareReplayProgress(local);
  const right = prepareReplayProgress(remote);
  if (left.attemptNumber !== right.attemptNumber) {
    if (getAttemptNumber(left.attemptNumber) > getAttemptNumber(right.attemptNumber)
      && (right.completionRecorded || right.gaveUp)) {
      // A fresh server completion still has a cooldown, even if this browser's
      // clock or a migrated guest timestamp prepared a replay prematurely.
      return right;
    }
    return getAttemptNumber(left.attemptNumber) > getAttemptNumber(right.attemptNumber) ? left : right;
  }
  const leftComplete = !!(left.completionRecorded || left.gaveUp);
  const rightComplete = !!(right.completionRecorded || right.gaveUp);
  if (leftComplete !== rightComplete) return rightComplete ? right : left;
  const leftProgress = (left.guessCount ?? 0) + getProgressHintCount(left);
  const rightProgress = (right.guessCount ?? 0) + getProgressHintCount(right);
  if (leftProgress !== rightProgress) return rightProgress > leftProgress ? right : left;
  return Date.parse(right.updatedAt ?? '') > Date.parse(left.updatedAt ?? '') ? right : left;
}
