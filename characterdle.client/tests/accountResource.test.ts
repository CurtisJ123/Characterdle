import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountApiError, AccountResource } from '../src/lib/accountResource.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('account requests deduplicate StrictMode mounts and reuse fresh data', async () => {
  const cache = new AccountResource<{ premium: boolean }>();
  const pending = deferred<{ premium: boolean }>();
  let calls = 0;
  const loader = () => { calls++; return pending.promise; };
  const first = cache.load('a', 'premium', loader);
  assert.equal(cache.load('a', 'premium', loader), first);
  assert.equal(cache.peek('a', 'premium').isLoading, true);
  pending.resolve({ premium: true });
  await first;
  const snapshot = cache.peek('a', 'premium');
  await cache.load('a', 'premium', loader);
  assert.equal(cache.peek('a', 'premium'), snapshot);
  assert.equal(calls, 1);
});

test('background refresh preserves visible data and applies updated entitlement', async () => {
  let now = 0;
  const cache = new AccountResource<{ premium: boolean }>(() => now, 100);
  await cache.load('a', 'premium', async () => ({ premium: true }));
  now = 101;
  const pending = deferred<{ premium: boolean }>();
  const refresh = cache.load('a', 'premium', () => pending.promise);
  assert.deepEqual(cache.peek('a', 'premium'), { data: { premium: true }, error: null, isLoading: false });
  pending.resolve({ premium: false });
  await refresh;
  assert.equal(cache.peek('a', 'premium').data?.premium, false);
});

test('transient failures retain data, back off, and allow explicit retry', async () => {
  const cache = new AccountResource<{ streak: number }>();
  await cache.load('a', 'got', async () => ({ streak: 14 }));
  const error = new AccountApiError('Temporary outage', 503);
  await cache.load('a', 'got', async () => { throw error; }, true);
  assert.deepEqual(cache.peek('a', 'got'), { data: { streak: 14 }, error, isLoading: false });
  let calls = 0;
  const loader = async () => { calls++; return { streak: 15 }; };
  await cache.load('a', 'got', loader);
  assert.equal(calls, 0);
  await cache.load('a', 'got', loader, true);
  assert.equal(cache.peek('a', 'got').data?.streak, 15);
  assert.equal(cache.peek('a', 'got').error, null);
});

for (const status of [401, 403]) {
  test(`authorization failure ${status} clears cached account data`, async () => {
    const cache = new AccountResource<{ premium: boolean }>();
    await cache.load('a', 'premium', async () => ({ premium: true }));
    await cache.load('a', 'premium', async () => { throw new AccountApiError('Not allowed', status); }, true);
    assert.equal(cache.peek('a', 'premium').data, null);
    assert.equal(cache.peek('a', 'premium').isLoading, false);
  });
}

test('accounts and universes have isolated data', async () => {
  const cache = new AccountResource<{ streak: number }>();
  await cache.load('a', 'got', async () => ({ streak: 14 }));
  assert.equal(cache.peek('b', 'got'), cache.empty);
  assert.equal(cache.peek('a', 'other'), cache.empty);
  assert.equal(cache.signedOut.data, null);
  await cache.load('b', 'got', async () => ({ streak: 1 }));
  assert.equal(cache.peek('a', 'got').data?.streak, 14);
});

test('sign-out clears cache and ignores late responses even after same-account login', async () => {
  const cache = new AccountResource<{ premium: boolean }>();
  const old = deferred<{ premium: boolean }>();
  let signal!: AbortSignal;
  const request = cache.load('a', 'premium', current => { signal = current; return old.promise; });
  await Promise.resolve();
  cache.clear();
  assert.equal(signal.aborted, true);
  assert.equal(cache.peek('a', 'premium'), cache.empty);
  await cache.load('a', 'premium', async () => ({ premium: false }));
  old.resolve({ premium: true });
  await request;
  assert.equal(cache.peek('a', 'premium').data?.premium, false);
});

test('explicit reload supersedes an older request and notifies subscribers', async () => {
  const cache = new AccountResource<{ name: string }>();
  const old = deferred<{ name: string }>();
  const snapshots: unknown[] = [];
  const unsubscribe = cache.subscribe(() => snapshots.push(cache.peek('a', 'got')));
  const first = cache.load('a', 'got', () => old.promise);
  await cache.load('a', 'got', async () => ({ name: 'Updated' }), true);
  old.resolve({ name: 'Old' });
  await first;
  assert.equal(cache.peek('a', 'got').data?.name, 'Updated');
  assert.equal(snapshots.length, 3);
  unsubscribe();
  cache.clear();
  assert.equal(snapshots.length, 3);
});
