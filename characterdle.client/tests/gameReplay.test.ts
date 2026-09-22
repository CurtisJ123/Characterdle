import assert from 'node:assert/strict';
import test from 'node:test';
import { getArchiveGameOutcome, getAttemptNumber, isReplayAvailable, mergeReplayProgress,
  prepareReplayProgress } from '../src/lib/gameReplay.ts';

const now = Date.parse('2026-09-22T12:00:00Z');
const boundary = '2026-08-23T12:00:00Z';
const recent = '2026-09-21T12:00:00Z';

test('archive distinguishes no-hint wins, hinted wins, give-ups, and unfinished rounds', () => {
  assert.equal(getArchiveGameOutcome('won', 0, recent, now), 'won');
  assert.equal(getArchiveGameOutcome('won', 1, recent, now), 'won-with-hints');
  assert.equal(getArchiveGameOutcome('lost', 3, recent, now), 'lost');
  assert.equal(getArchiveGameOutcome('playing', 1, null, now), 'pending');
});

for (const status of ['won', 'lost']) {
  test(`${status} with hints resets at exactly 30 days, not a millisecond earlier`, () => {
    assert.equal(isReplayAvailable(status, 1, boundary, now - 1), false);
    assert.equal(isReplayAvailable(status, 1, boundary, now), true);
    assert.equal(getArchiveGameOutcome(status, 1, boundary, now), 'pending');
  });
}

test('a no-hint win never expires, but a no-hint give-up can', () => {
  assert.equal(isReplayAvailable('won', 0, '2020-01-01', now), false);
  assert.equal(isReplayAvailable('lost', 0, boundary, now), true);
  assert.equal(getArchiveGameOutcome('won', 0, boundary, now), 'won');
});

test('missing, malformed, and future completion dates cannot unlock a replay', () => {
  for (const date of [null, undefined, '', 'invalid', '2027-01-01']) {
    assert.equal(isReplayAvailable('won', 2, date, now), false);
    assert.equal(isReplayAvailable('lost', 0, date, now), false);
  }
  assert.equal(isReplayAvailable('playing', 2, boundary, now), false);
});

test('a replay clears hints, guesses and the completion timestamp, advancing the attempt once', () => {
  const state = prepareReplayProgress({ attemptNumber: 3, completionRecorded: true, gaveUp: false,
    firstLetterRevealed: true, guessCount: 4, guessedCharacterIds: [4, 3, 2, 1],
    revealedHintKeys: ['gender'], resolvedAt: boundary }, now);
  assert.equal(state.attemptNumber, 4);
  assert.equal(state.completionRecorded, false);
  assert.equal(state.gaveUp, false);
  assert.equal(state.guessCount, 0);
  assert.equal(state.firstLetterRevealed, false);
  assert.deepEqual(state.guessedCharacterIds, []);
  assert.deepEqual(state.revealedHintKeys, []);
  assert.equal(state.resolvedAt, null);
  assert.deepEqual(prepareReplayProgress(state, now), state);
});

test('every hinted replay starts a fresh 30-day cycle', () => {
  const next = prepareReplayProgress({ attemptNumber: 1, completionRecorded: true,
    revealedHintKeys: ['house'], resolvedAt: recent }, now);
  assert.equal(next.attemptNumber, 1);
  assert.equal(next.completionRecorded, true);
  const expired = prepareReplayProgress(next, Date.parse(recent) + 30 * 86400000);
  assert.equal(expired.attemptNumber, 2);
  assert.equal(expired.completionRecorded, false);
});

test('legacy states default to attempt zero and first-letter counts as a hint', () => {
  assert.equal(getAttemptNumber(undefined), 0);
  for (const value of [-1, 0.5, NaN, Infinity]) assert.equal(getAttemptNumber(value), 0);
  const reset = prepareReplayProgress({ completionRecorded: true, firstLetterRevealed: true,
    resolvedAt: boundary }, now);
  assert.equal(reset.attemptNumber, 1);
});

test('an old remote victory cannot overwrite an in-progress replay', () => {
  const local = { attemptNumber: 1, guessCount: 2, guessedCharacterIds: [2, 3] };
  const remote = { attemptNumber: 0, completionRecorded: true, guessCount: 5,
    hintCount: 1, resolvedAt: '2020-01-01' };
  assert.equal(mergeReplayProgress(local, remote).guessCount, 2);
  assert.equal(mergeReplayProgress(local, remote).attemptNumber, 1);
});

test('a newer server attempt replaces stale completed local progress', () => {
  const local = { attemptNumber: 0, completionRecorded: true, guessCount: 5 };
  const remote = { attemptNumber: 1, guessCount: 1 };
  assert.equal(mergeReplayProgress(local, remote).guessCount, 1);
  assert.equal(mergeReplayProgress(local, remote).completionRecorded, undefined);
});

test('fresh devices prepare the same replay as the existing browser', () => {
  const remote = { attemptNumber: 2, completionRecorded: true, guessCount: 6,
    hintCount: 1, resolvedAt: '2020-01-01' };
  const merged = mergeReplayProgress({}, remote);
  assert.equal(merged.attemptNumber, 3);
  assert.equal(merged.guessCount, 0);
  assert.equal(merged.completionRecorded, false);
});

test('a server completion still inside its cooldown overrides a premature local replay', () => {
  const merged = mergeReplayProgress({ attemptNumber: 1, guessCount: 1 }, {
    attemptNumber: 0, completionRecorded: true, guessCount: 4,
    hintCount: 1, resolvedAt: new Date().toISOString(),
  });
  assert.equal(merged.attemptNumber, 0);
  assert.equal(merged.completionRecorded, true);
});
