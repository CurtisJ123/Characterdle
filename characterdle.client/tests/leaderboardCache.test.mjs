import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import { build } from 'vite';

let api;
const data = (points = 100) => ({
  overview: { playerCount: 1, totalPoints: points, daysPlayed: 1, pointsPerDay: points },
  rows: [], currentUser: null,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

before(async () => {
  const bundle = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: 'error',
    plugins: [{ name: 'offline-leaderboard-cache', enforce: 'pre',
      resolveId(source) { if (source.endsWith('/lib/runtimeConfig')) return '\0test-config'; },
      load(id) { if (id === '\0test-config') return 'export const buildApiUrl = path => `http://leaderboard.test${path}`;'; },
    }],
    build: { ssr: 'tests/fixtures/leaderboardCache.ts', write: false },
  });
  const entry = bundle.output.find(item => item.type === 'chunk' && item.isEntry);
  api = await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);
});

beforeEach(() => api.clearLeaderboardCache());

test('Ladder shares in-flight requests and resolved results across tabs, revisits, and token refreshes', async t => {
  const response = deferred();
  const fetch = t.mock.method(globalThis, 'fetch', () => response.promise);
  const first = api.getEpisodeLadderLeaderboard('got', 'token-a', 'user-a');
  const second = api.getEpisodeLadderLeaderboard('got', 'token-a', 'user-a');
  assert.equal(first, second);
  response.resolve(Response.json(data()));
  const result = await first;
  assert.equal(await api.getEpisodeLadderLeaderboard('got', 'refreshed-token-a', 'user-a'), result);
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'user-a').data, result);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(fetch.mock.calls[0].arguments[1].headers.Authorization, 'Bearer token-a');
});

test('cache scopes separate accounts, signed-out visitors, and universes', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data()));
  for (const [universe, token, scope] of [['got', 'a', 'a'], ['got', 'b', 'b'], ['got', null, 'guest'], ['other', 'a', 'a']]) {
    await api.getEpisodeLadderLeaderboard(universe, token, scope);
  }
  assert.equal(fetch.mock.callCount(), 4);
  assert.equal(fetch.mock.calls[2].arguments[1].headers.Authorization, undefined);
  const b = api.getEpisodeLadderLeaderboardSnapshot('got', 'b');
  const other = api.getEpisodeLadderLeaderboardSnapshot('other', 'a');
  api.clearEpisodeLadderLeaderboardCache('got', 'a');
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'a'), api.emptyEpisodeLadderLeaderboard);
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'b'), b);
  api.clearLeaderboardCache('got');
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'b'), api.emptyEpisodeLadderLeaderboard);
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('other', 'a'), other);
});

test('failed requests can retry instead of poisoning the cache', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(api.getEpisodeLadderLeaderboard('got', null, 'guest'), /Unable to load/);
  assert.ok(api.getEpisodeLadderLeaderboardSnapshot('got', 'guest').error);
  fetch.mock.mockImplementation(async () => Response.json(data()));
  await api.getEpisodeLadderLeaderboard('got', null, 'guest');
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'guest').error, null);
  assert.equal(fetch.mock.callCount(), 2);
});

test('invalidation notifies mounted views during loading and ignores late stale responses', async t => {
  const stale = deferred();
  const fetch = t.mock.method(globalThis, 'fetch', () => stale.promise);
  const snapshots = [];
  const unsubscribe = api.subscribeEpisodeLadderLeaderboard(() => {
    snapshots.push(api.getEpisodeLadderLeaderboardSnapshot('got', 'a'));
  });
  t.after(unsubscribe);
  const first = api.getEpisodeLadderLeaderboard('got', 'a', 'a');
  api.clearEpisodeLadderLeaderboardCache('got');
  assert.equal(fetch.mock.calls[0].arguments[1].signal.aborted, true);
  assert.notEqual(snapshots[0], snapshots[1]);
  assert.equal(snapshots[1], api.emptyEpisodeLadderLeaderboard);
  fetch.mock.mockImplementation(async () => Response.json(data(200)));
  await api.getEpisodeLadderLeaderboard('got', 'a', 'a');
  stale.resolve(Response.json(data(100)));
  await first;
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'a').data.overview.totalPoints, 200);
});

for (const [label, status, submission] of [
  ['win', 'won', { attempts: [] }], ['loss', 'lost', { attempts: [] }],
  ['guest victory import', 'won', { attempts: [], importGuest: true }],
]) {
  test(`${label} invalidates both Ladder points and the existing streak leaderboard`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => Response.json(
      options.method === 'POST' ? { status } : data(),
    ));
    await api.getLeaderboard('got', 'a', 'a');
    await api.getEpisodeLadderLeaderboard('got', 'a', 'a');
    await api.requestEpisodeLadder(93, 'a', undefined, submission);
    assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'a'), api.emptyEpisodeLadderLeaderboard);
    await api.getLeaderboard('got', 'a', 'a');
    await api.getEpisodeLadderLeaderboard('got', 'a', 'a');
    assert.equal(fetch.mock.callCount(), 5);
  });
}

test('read-only game loads, unfinished attempts, guest games, and random games retain cached standings', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(data()));
  await api.getEpisodeLadderLeaderboard('got', 'a', 'a');
  const snapshot = api.getEpisodeLadderLeaderboardSnapshot('got', 'a');
  fetch.mock.mockImplementation(async () => Response.json({ status: 'won' }));
  await api.requestEpisodeLadder(93, 'a');
  await api.requestEpisodeLadder(93, null, undefined, { attempts: [] });
  await api.requestRandomLadder('a', new AbortController().signal, { roundToken: 'test', order: [] });
  fetch.mock.mockImplementation(async () => Response.json({ status: 'playing' }));
  await api.requestEpisodeLadder(93, 'a', undefined, { attempts: [] });
  assert.equal(api.getEpisodeLadderLeaderboardSnapshot('got', 'a'), snapshot);
});
