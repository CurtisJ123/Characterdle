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

test('swapping slots one and three leaves slot two and all other events in place', () => {
  assert.deepEqual(moveLadderEvent([1, 2, 3, 4, 5], 0, 2, []), [3, 2, 1, 4, 5]);
  assert.deepEqual(moveLadderEvent([1, 2, 3, 4, 5], 2, 0, []), [3, 2, 1, 4, 5]);
});

test('swapping across locked slots keeps both locked and other unlocked cards in place', () => {
  assert.deepEqual(moveLadderEvent([5, 2, 3, 4, 1], 0, 4, [1, 2]), [1, 2, 3, 4, 5]);
  assert.deepEqual(moveLadderEvent([5, 2, 3, 4, 1], 4, 0, [1, 2]), [1, 2, 3, 4, 5]);
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
      if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length
        || locked.includes(from) || locked.includes(to)) {
        assert.equal(moved, order);
      } else {
        assert.equal(moved[from], order[to]);
        assert.equal(moved[to], order[from]);
        order.forEach((id, index) => { if (index !== from && index !== to) assert.equal(moved[index], id); });
        assert.deepEqual(moveLadderEvent(moved, from, to, locked), order);
      }
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

test('inserting shifts intervening events in both directions rather than swapping', () => {
  assert.deepEqual(moveLadderEvent([1, 2, 3, 4, 5], 0, 2, [], 'insert'), [2, 3, 1, 4, 5]);
  assert.deepEqual(moveLadderEvent([1, 2, 3, 4, 5], 3, 1, [], 'insert'), [1, 4, 2, 3, 5]);
});

test('inserting skips locked slots and preserves the relative order of all other unlocked events', () => {
  for (let mask = 0; mask < 32; mask++) {
    const locked = [0, 1, 2, 3, 4].filter(index => mask & (1 << index));
    for (let from = -1; from <= 5; from++) for (let to = -1; to <= 5; to++) {
      const order = [5, 4, 3, 2, 1];
      const moved = moveLadderEvent(order, from, to, locked, 'insert');
      assert.deepEqual(order, [5, 4, 3, 2, 1]);
      assert.deepEqual([...moved].sort(), [1, 2, 3, 4, 5]);
      locked.forEach(index => assert.equal(moved[index], order[index]));
      if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length
        || locked.includes(from) || locked.includes(to)) {
        assert.equal(moved, order);
      } else {
        assert.equal(moved[to], order[from]);
        const others = order.filter((id, index) => !locked.includes(index) && id !== order[from]);
        assert.deepEqual(moved.filter((id, index) => !locked.includes(index) && id !== order[from]), others);
        assert.deepEqual(moveLadderEvent(moved, to, from, locked, 'insert'), order);
      }
    }
  }
});

test('invalid fractional or non-finite positions cannot alter the board', () => {
  const order = [1, 2, 3, 4, 5];
  for (const position of [NaN, Infinity, 1.5]) for (const mode of ['swap', 'insert'] as const) {
    assert.equal(moveLadderEvent(order, position, 2, [], mode), order);
    assert.equal(moveLadderEvent(order, 0, position, [], mode), order);
  }
});
