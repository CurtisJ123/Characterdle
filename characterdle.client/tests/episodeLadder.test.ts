import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLadderShareText, moveLadderEvent } from '../src/lib/episodeLadder.ts';
import { buildRoutePath } from '../src/lib/routePaths.ts';

test('random routes preserve the selected mode without a daily game ID', () => {
  const route = { authMode: 'login', page: 'random', universeId: 'got', gameId: null } as const;
  assert.equal(buildRoutePath({ ...route, gameMode: 'character' }), '/got/random');
  assert.equal(buildRoutePath({ ...route, gameMode: 'quote' }), '/got/random/quote');
  assert.equal(buildRoutePath({ ...route, gameMode: 'episode_ladder' }), '/got/random/episode_ladder');
});

test('moving past locked slots keeps them in place', () => {
  assert.deepEqual(moveLadderEvent([5, 2, 3, 4, 1], 0, 4, [1, 2]), [4, 2, 3, 1, 5]);
  assert.deepEqual(moveLadderEvent([5, 2, 3, 4, 1], 4, 0, [1, 2]), [1, 2, 3, 5, 4]);
});

test('every locked-slot combination preserves locked cards, unique IDs and the original input', () => {
  for (let mask = 0; mask < 32; mask++) {
    const locked = [0, 1, 2, 3, 4].filter(index => mask & (1 << index));
    for (let from = -1; from <= 5; from++) for (let to = -1; to <= 5; to++) {
      const order = [5, 4, 3, 2, 1];
      const moved = moveLadderEvent(order, from, to, locked);
      assert.deepEqual(order, [5, 4, 3, 2, 1]);
      assert.deepEqual([...moved].sort(), [1, 2, 3, 4, 5]);
      for (const position of locked) assert.equal(moved[position], order[position]);
      if (locked.includes(from) || locked.includes(to)) assert.equal(moved, order);
    }
  }
});

test('share text uses dynamic game, difficulty, attempt count and spoiler-free feedback', () => {
  const text = buildLadderShareText({ gameId: 73, difficulty: 4, maxAttempts: 4, status: 'won', attempts: [
    { order: [19, 22, 7, 5, 11], feedback: ['correct', 'incorrect', 'adjacent', 'adjacent', 'incorrect'] },
    { order: [19, 5, 22, 11, 7], feedback: ['correct', 'correct', 'correct', 'correct', 'correct'] },
  ] });
  assert.match(text, /Episode Ladder #73/);
  assert.match(text, /Expert .* 2\/4/);
  assert.ok(text.includes('\u{1F7E9}\u2B1B\u{1F7E8}\u{1F7E8}\u2B1B'));
  assert.ok(!text.includes('19'));
  assert.match(buildLadderShareText({ gameId: 1, difficulty: 1, maxAttempts: 4, status: 'lost', attempts: [] }), /X\/4/);
});
