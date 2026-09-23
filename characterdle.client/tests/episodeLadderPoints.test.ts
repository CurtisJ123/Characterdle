import assert from 'node:assert/strict';
import test from 'node:test';
import { LADDER_BASE_POINTS, LADDER_DAY_MAX_POINTS, ladderPoints } from '../src/lib/episodeLadder.ts';

test('display scores match the server leaderboard for every difficulty and attempt count', () => {
  const expected = [[10, 8, 6, 4], [15, 12, 9, 6], [20, 16, 12, 8], [25, 20, 15, 10], [30, 24, 18, 12]];
  assert.deepEqual(LADDER_BASE_POINTS, [10, 15, 20, 25, 30]);
  assert.equal(LADDER_DAY_MAX_POINTS, 100);
  expected.forEach((scores, index) => scores.forEach((points, attempt) => {
    assert.equal(ladderPoints(index + 1, 'won', attempt + 1), points);
    assert.equal(ladderPoints(index + 1, 'lost', attempt + 1), 0);
    assert.equal(ladderPoints(index + 1, 'playing', attempt + 1), 0);
  }));
});

test('missing or invalid guest results never add points', () => {
  for (const difficulty of [0, 6, 1.5, NaN]) assert.equal(ladderPoints(difficulty, 'won', 1), 0);
  for (const attempts of [0, 5, 1.5, NaN]) assert.equal(ladderPoints(1, 'won', attempts), 0);
  assert.equal(ladderPoints(1, 'pending', 1), 0);
});
