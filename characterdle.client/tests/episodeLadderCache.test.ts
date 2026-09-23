import assert from 'node:assert/strict';
import test from 'node:test';
import { EpisodeLadderCache, ladderDay, ladderScope, LADDER_CACHE_TTL } from '../src/lib/episodeLadderCache.ts';
import type { EpisodeLadderGame } from '../src/types/episodeLadder.ts';

const scope = ladderScope('one');
const game = (id = 93, difficulty = 1): EpisodeLadderGame => ({ gameId: id, difficulty,
  dateTime: '2026-09-22T04:00:00Z', maxAttempts: 4, events: [], initialOrder: [5, 4, 3, 2, 1],
  attempts: [], lockedPositions: [], status: 'playing', solution: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a click shares an in-flight preload and current/numbered routes share the result', async () => {
  const cache = new EpisodeLadderCache();
  const pending = deferred<EpisodeLadderGame>();
  let calls = 0;
  const fetcher = () => { calls++; return pending.promise; };
  const warm = cache.load(scope, null, 1, fetcher, { background: true });
  const click = cache.load(scope, null, 1, fetcher);
  assert.equal(warm, click);
  pending.resolve(game());
  await warm;
  assert.equal(cache.peek(scope, null, 1), cache.peek(scope, 93, 1));
  await cache.load(scope, 93, 1, fetcher);
  assert.equal(calls, 1);
});

test('draft order survives navigation and a refresh with unchanged attempts', async () => {
  const cache = new EpisodeLadderCache();
  await cache.load(scope, null, 1, async () => game());
  cache.setOrder(scope, 93, 1, [3, 4, 5, 2, 1]);
  cache.set(scope, game(93, 2));
  await cache.load(scope, null, 1, async () => game(), { force: true });
  assert.deepEqual(cache.peek(scope, null, 1)?.order, [3, 4, 5, 2, 1]);
  const completed = { ...game(), status: 'won' as const, attempts: [{ order: [1, 2, 3, 4, 5], feedback: [] }] };
  cache.set(scope, completed);
  assert.deepEqual(cache.peek(scope, null, 1)?.order, [1, 2, 3, 4, 5]);
  assert.equal(cache.peek(scope, 93, 2)?.game.difficulties?.[0], 'won');
});

test('TTL refresh retains a usable snapshot while loading, but a new Eastern day does not', async () => {
  let now = Date.parse('2026-09-22T15:00:00Z');
  const cache = new EpisodeLadderCache(() => now);
  await cache.load(scope, null, 1, async () => game());
  const first = cache.peek(scope, null, 1);
  now += LADDER_CACHE_TTL + 1;
  assert.equal(cache.peek(scope, null, 1), first);
  let calls = 0;
  await cache.load(scope, null, 1, async () => { calls++; return game(); });
  assert.equal(calls, 1);
  now = Date.parse('2026-09-23T04:00:01Z');
  assert.equal(cache.peek(scope, null, 1), undefined);
  await cache.load(scope, null, 1, async () => game(94));
  assert.equal(cache.peek(scope, null, 1)?.game.gameId, 94);
  assert.equal(ladderDay(Date.parse('2026-12-01T04:59:00Z')), '2026-11-30');
  assert.equal(ladderDay(Date.parse('2026-12-01T05:00:00Z')), '2026-12-01');
});

test('a current-game response crossing midnight is resolved again before being cached', async () => {
  let now = Date.parse('2026-09-23T03:59:59Z');
  const cache = new EpisodeLadderCache(() => now);
  const pending = deferred<EpisodeLadderGame>();
  let calls = 0;
  const request = cache.load(scope, null, 1, () => ++calls === 1 ? pending.promise : Promise.resolve(game(94)));
  now = Date.parse('2026-09-23T04:00:01Z');
  pending.resolve(game(93));
  await request;
  assert.equal(calls, 2);
  assert.equal(cache.peek(scope, null, 1)?.game.gameId, 94);
});

test('identity and entitlement scopes never share progress; clear aborts pending responses', async () => {
  const cache = new EpisodeLadderCache();
  cache.set(scope, game());
  for (const other of [ladderScope(), ladderScope('two'), ladderScope('one', true)]) {
    assert.equal(cache.peek(other, 93, 1), undefined);
  }
  const pending = deferred<EpisodeLadderGame>();
  const request = cache.load(scope, null, 2, () => pending.promise);
  cache.clear();
  pending.resolve(game(93, 2));
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(cache.peek(scope, 93, 1), undefined);
});

test('submission supersedes older reads without discarding the cached draft', async () => {
  const cache = new EpisodeLadderCache();
  await cache.load(scope, null, 1, async () => game());
  const pending = deferred<EpisodeLadderGame>();
  const request = cache.load(scope, null, 1, () => pending.promise, { force: true });
  cache.cancelReads(scope, 93, 1);
  cache.set(scope, { ...game(), status: 'won' });
  pending.resolve(game());
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(cache.peek(scope, null, 1)?.game.status, 'won');
});

test('foreground work cancels another speculative request and failures can retry', async () => {
  const cache = new EpisodeLadderCache();
  const pending = deferred<EpisodeLadderGame>();
  const background = cache.load(scope, null, 2, () => pending.promise, { background: true });
  await cache.load(scope, null, 1, async () => game());
  pending.resolve(game(93, 2));
  await assert.rejects(background, { name: 'AbortError' });
  await assert.rejects(cache.load(scope, null, 2, async () => { throw new Error('offline'); }));
  assert.equal(cache.peek(scope, null, 2), undefined);
  await cache.load(scope, null, 2, async () => game(93, 2));
  assert.equal(cache.peek(scope, null, 2)?.game.difficulty, 2);
});

test('invalidating an entitlement failure removes both aliases and bounds retained boards', async () => {
  const cache = new EpisodeLadderCache();
  await cache.load(scope, null, 1, async () => game());
  cache.invalidate(scope, null, 1);
  assert.equal(cache.peek(scope, 93, 1), undefined);
  for (let id = 1; id <= 120; id++) cache.set(scope, game(id));
  assert.equal(cache.peek(scope, 1, 1), undefined);
  assert.ok(cache.peek(scope, 120, 1));
});
