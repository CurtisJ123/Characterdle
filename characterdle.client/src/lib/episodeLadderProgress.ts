import { EpisodeLadderApiError, requestEpisodeLadder } from '../services/episodeLadderApi';
import type { EpisodeLadderGame } from '../types/episodeLadder';
import { ladderPoints } from './episodeLadder';

const PREFIX = 'episode-ladder:got:';
interface StoredLadder {
  attempts: number[][];
  status: EpisodeLadderGame['status'];
  migratedTo?: string;
}

function key(owner: string, gameId: number, difficulty?: number) { return `${PREFIX}${owner}:${gameId}${difficulty ? `:${difficulty}` : ''}`; }

export function readLadderProgress(owner: string, gameId: number, difficulty?: number): StoredLadder | null {
  if (difficulty === undefined) {
    const levels = [1, 2, 3, 4, 5].map(level => readLadderProgress(owner, gameId, level));
    const finished = levels.find(level => level?.status === 'won') ?? levels.find(level => level?.status === 'lost');
    if (finished) return finished;
  }
  try {
    const data = JSON.parse(localStorage.getItem(key(owner, gameId, difficulty)) ?? 'null') as StoredLadder | null;
    return data && Array.isArray(data.attempts) && data.attempts.length <= 4
      && data.attempts.every(order => Array.isArray(order) && order.length === 5 && order.every(Number.isSafeInteger))
      ? data : null;
  } catch { return null; }
}

export function readLegacyLadderProgress(owner: string, game: EpisodeLadderGame): StoredLadder | null {
  try {
    const old = JSON.parse(localStorage.getItem(key(owner, game.gameId)) ?? 'null') as StoredLadder | null;
    return old?.attempts?.length && old.attempts.length <= 4 && old.attempts.every(order =>
      Array.isArray(order) && order.length === 5 && order.every(id => game.initialOrder.includes(id))) ? old : null;
  } catch { return null; }
}

export function withGuestLadderDayProgress(game: EpisodeLadderGame): EpisodeLadderGame {
  const saved = [1, 2, 3, 4, 5].map(level => readLadderProgress('guest', game.gameId, level));
  const difficulties = saved.map(progress => progress?.status ?? 'pending');
  const difficultyPoints = saved.map((progress, index) => ladderPoints(index + 1, progress?.status ?? 'pending', progress?.attempts.length ?? 0));
  // Use this validated response even if browser storage is unavailable or contains an older attempt.
  difficulties[game.difficulty - 1] = game.status;
  difficultyPoints[game.difficulty - 1] = ladderPoints(game.difficulty, game.status, game.attempts.length);
  return { ...game, difficulties, difficultyPoints };
}

export function storeLadderProgress(owner: string, game: EpisodeLadderGame): void {
  try {
    const previous = readLadderProgress(owner, game.gameId, game.difficulty);
    localStorage.setItem(key(owner, game.gameId, game.difficulty), JSON.stringify({
      attempts: game.attempts.map(attempt => attempt.order), status: game.status, migratedTo: previous?.migratedTo,
    }));
  } catch { /* The server still saves signed-in progress when storage is unavailable. */ }
}

let fallbackGuestId: string | undefined;
export function ladderGuestId(): string {
  try {
    const existing = localStorage.getItem('episode-ladder-guest-id');
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = fallbackGuestId ??= crypto.randomUUID();
    localStorage.setItem('episode-ladder-guest-id', id);
    return id;
  } catch { return fallbackGuestId ??= crypto.randomUUID(); }
}

const migrations = new Map<string, Promise<void>>();
export function migrateGuestLadderVictories(userId: string, token: string): Promise<void> {
  const pending = migrations.get(userId);
  if (pending) return pending;
  const work = (async () => {
    let keys: string[];
    try { keys = Object.keys(localStorage).filter(value => value.startsWith(`${PREFIX}guest:`)); }
    catch { return; }
    for (const storageKey of keys) {
      const parts = storageKey.slice(`${PREFIX}guest:`.length).split(':');
      const gameId = Number(parts[0]);
      let difficulty = Number(parts[1]);
      if (!Number.isSafeInteger(gameId) || gameId < 1) continue;
      let stored: StoredLadder | null;
      try {
        stored = parts.length === 1 ? JSON.parse(localStorage.getItem(storageKey) ?? 'null') as StoredLadder | null
          : readLadderProgress('guest', gameId, difficulty);
      } catch { continue; }
      if (!stored || stored.status !== 'won' || stored.migratedTo) continue;
      try {
        if (parts.length === 1) {
          for (let level = 1; level <= 5; level++) {
            const candidate = await requestEpisodeLadder(gameId, token, AbortSignal.timeout(15000), undefined, level);
            if (readLegacyLadderProgress('guest', candidate)) { difficulty = level; break; }
          }
        }
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) continue;
        const game = await requestEpisodeLadder(gameId, token, AbortSignal.timeout(15000), { attempts: stored.attempts, importGuest: true }, difficulty);
        storeLadderProgress(`user:${userId}`, game);
        window.dispatchEvent(new CustomEvent('ladder-guest-imported', { detail: { userId, game } }));
        localStorage.setItem(storageKey, JSON.stringify({ ...stored, migratedTo: userId }));
      } catch (error) {
        if (error instanceof EpisodeLadderApiError && error.status === 409 && error.current?.status !== 'playing') {
          localStorage.setItem(storageKey, JSON.stringify({ ...stored, migratedTo: userId }));
        }
        // Keep unacknowledged victories for the next sign-in, focus, or online retry.
      }
    }
  })().catch(() => {
    // Storage failures must not interrupt authentication or the existing result outbox.
  }).finally(() => migrations.delete(userId));
  migrations.set(userId, work);
  return work;
}
