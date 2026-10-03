import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseModerationGuests } from '../src/lib/playerModeration.ts';
import { LeaderboardResource } from '../src/lib/leaderboardResource.ts';
import { ladderGuestId, leaderboardHeaders, leaderboardScope } from '../src/lib/guestIdentity.ts';

test('guest IDs normalize without accepting duplicates, empty UUIDs or malformed IDs', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.deepEqual(parseModerationGuests(` guest:${id.toUpperCase()} `), [id]);
  assert.deepEqual(parseModerationGuests(''), []);
  assert.throws(() => parseModerationGuests(`${id}\nguest:${id}`));
  assert.throws(() => parseModerationGuests('00000000-0000-0000-0000-000000000000'));
  assert.throws(() => parseModerationGuests('no-id'));
});

test('leaderboard guest transport reuses the existing ladder identity; authentication overrides it', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let value = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => value, setItem: (_key: string, id: string) => { value = id; } } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  assert.equal(ladderGuestId(), value);
  const first = leaderboardScope(null, 'guest');
  assert.equal(leaderboardHeaders(null)['X-Leaderboard-Guest-Id'], value);
  value = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.notEqual(leaderboardScope(null, 'guest'), first);
  assert.equal(leaderboardScope('token', 'account'), 'user:account');
  assert.equal(leaderboardHeaders('token')['X-Leaderboard-Guest-Id'], undefined);
  assert.equal(leaderboardHeaders('token').Authorization, 'Bearer token');
});

test('leaderboard caches expire after 45 seconds, revalidate without blanking, and fail closed', async () => {
  let now = 0; let calls = 0;
  const cache = new LeaderboardResource<number>(() => now);
  const load = async () => ++calls;
  assert.equal(await cache.load('guest:a', load), 1);
  now = 44_999;
  assert.equal(await cache.load('guest:a', load), 1);
  now = 45_000;
  const refresh = cache.load('guest:a', load);
  assert.equal(cache.peek('guest:a').data, 1);
  assert.equal(await refresh, 2);
  assert.equal(await cache.load('guest:b', load), 3);
  now += 45_000;
  await assert.rejects(cache.load('guest:a', async () => { throw new Error('unavailable'); }));
  assert.equal(cache.peek('guest:a').data, null);
  assert.ok(cache.peek('guest:a').error);
  assert.equal(await cache.load('guest:a', load), 4);
});

test('clearing identity aborts requests and a late response cannot repopulate another view', async () => {
  const cache = new LeaderboardResource<number>();
  let resolve!: (value: number) => void; let signal!: AbortSignal;
  const request = cache.load('user:a', async s => { signal = s; return new Promise<number>(done => { resolve = done; }); });
  cache.clear();
  assert.equal(signal.aborted, true);
  await cache.load('user:b', async () => 20);
  resolve(10); await request;
  assert.equal(cache.peek('user:a'), cache.empty);
  assert.equal(cache.peek('user:b').data, 20);
});
