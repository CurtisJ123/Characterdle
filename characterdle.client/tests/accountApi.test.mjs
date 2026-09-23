import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'vite';

let api;
before(async () => {
  const bundle = await build({ configFile: false, envFile: false, publicDir: false, logLevel: 'error',
    plugins: [{ name: 'offline-account-api', enforce: 'pre',
      resolveId(source) { if (source.endsWith('/lib/runtimeConfig')) return '\0test-config'; },
      load(id) { if (id === '\0test-config') return 'export const buildApiUrl = path => `http://account.test${path}`;'; },
    }], build: { ssr: 'tests/fixtures/accountApi.ts', write: false },
  });
  const entry = bundle.output.find(item => item.type === 'chunk' && item.isEntry);
  api = await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);
});

test('concurrent results readers share one request without keeping stale results after completion', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  const first = api.getGameResults('a', 'got');
  assert.equal(api.getGameResults('a', 'got'), first);
  await first;
  await api.getGameResults('a', 'got');
  assert.equal(fetch.mock.callCount(), 2);
});

test('results requests are isolated by account credentials and universe', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  await Promise.all([api.getGameResults('a', 'got'), api.getGameResults('b', 'got'), api.getGameResults('a', 'other')]);
  assert.equal(fetch.mock.callCount(), 3);
});

test('failed results reads do not prevent a subsequent retry', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(api.getGameResults('a', 'got'));
  fetch.mock.mockImplementation(async () => Response.json([]));
  assert.deepEqual(await api.getGameResults('a', 'got'), []);
});

for (const name of ['getProfile', 'getPremiumState']) {
  test(`${name} propagates auth failures and uses cancellable private requests`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Unauthorized' }, { status: 401 }));
    const controller = new AbortController();
    const request = name === 'getProfile' ? api.getProfile('a', 'got', controller.signal) : api.getPremiumState('a', controller.signal);
    await assert.rejects(request, error => error instanceof api.AccountApiError && error.status === 401);
    const options = fetch.mock.calls[0].arguments[1];
    assert.equal(options.signal, controller.signal);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer a');
  });
}
