import type { EpisodeLadderGame } from '../types/episodeLadder';

export const LADDER_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert', 'Impossible'];
export const LADDER_BASE_POINTS = [10, 15, 20, 25, 30];
export const LADDER_DAY_MAX_POINTS = LADDER_BASE_POINTS.reduce((total, points) => total + points, 0);

// Display-only for guest progress; account scores always come from the server's leaderboard rules.
export function ladderPoints(difficulty: number, status: string, attempts: number): number {
  if (status !== 'won' || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5
    || !Number.isInteger(attempts) || attempts < 1 || attempts > 4) return 0;
  return Math.floor(LADDER_BASE_POINTS[difficulty - 1] * (5 - (attempts - 1)) / 5);
}

export function moveLadderEvent(order: number[], from: number, to: number, locked: readonly number[],
  mode: 'swap' | 'insert' = 'swap'): number[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= order.length || to >= order.length
    || locked.includes(from) || locked.includes(to)) return order;
  const next = [...order];
  if (mode === 'swap') {
    [next[from], next[to]] = [next[to], next[from]];
  } else {
    // Reorder only unlocked slots, leaving correct events in their exact positions.
    const slots = order.map((_, index) => index).filter(index => !locked.includes(index));
    const values = slots.map(index => order[index]);
    values.splice(slots.indexOf(to), 0, values.splice(slots.indexOf(from), 1)[0]);
    slots.forEach((slot, index) => { next[slot] = values[index]; });
  }
  return next;
}

export function buildLadderShareText(game: Pick<EpisodeLadderGame, 'gameId' | 'attempts' | 'difficulty' | 'status' | 'maxAttempts'>): string {
  const grid = game.attempts.map(attempt => attempt.feedback.map(tone =>
    tone === 'correct' ? '\u{1F7E9}' : tone === 'adjacent' ? '\u{1F7E8}' : '\u2B1B').join('')).join('\n');
  return [
    `Game of Thrones Episode Ladder #${game.gameId}`,
    `${LADDER_DIFFICULTIES[game.difficulty - 1]} \u00b7 ${game.status === 'won' ? game.attempts.length : 'X'}/${game.maxAttempts}`,
    grid,
  ].join('\n\n');
}
