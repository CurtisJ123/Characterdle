import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'vite';

let api;
before(async () => {
  const bundle = await build({ configFile: false, envFile: false, publicDir: false, logLevel: 'error',
    plugins: [{ name: 'offline-game-api', enforce: 'pre',
      resolveId(source) { if (source.endsWith('/lib/runtimeConfig')) return '\0test-config'; },
      load(id) { if (id === '\0test-config') return 'export const buildApiUrl = path => `http://game.test${path}`;'; },
    }], build: { ssr: 'src/services/universeGameApi.ts', write: false },
  });
  const entry = bundle.output.find(item => item.type === 'chunk' && item.isEntry);
  api = await import(`data:text/javascript;base64,${Buffer.from(entry.code).toString('base64')}`);
});

const character = { id: 345, displayName: 'Little Sam', aliases: [], attributes: {}, portraitUrl: '/images/sam.webp' };
const game = {
  id: 105, dateTime: '2026-10-06', universeId: 'got', universeName: 'Game of Thrones',
  characterStats: { averageGuessSampleSize: 0, averageGuesses: null, playCount: 0 },
  quoteStats: null, quotePrompt: null, attributeDefinitions: [],
};

test('daily and random API mapping preserves eligibility without dropping historical rendering data', async t => {
  const inactive = { ...character, canGuess: false };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...game, answerCharacter: inactive, characters: [inactive] }));
  for (const result of [await api.getUniverseGame('got', 105), await api.getRandomUniverseGame('got', 'quote')]) {
    assert.equal(result.characters.length, 1);
    assert.equal(result.characters[0].canGuess, false);
    assert.equal(result.answerCharacter.canGuess, false);
  }
});

test('historical eligibility and older server payloads remain playable', async t => {
  for (const canGuess of [true, undefined]) {
    const entry = { ...character, canGuess };
    t.mock.method(globalThis, 'fetch', async () => Response.json({ ...game, answerCharacter: entry, characters: [entry] }));
    const result = await api.getRandomUniverseGame('got', 'character');
    assert.equal(result.characters[0].canGuess, true);
  }
});

test('profile portrait options remain independent of guess eligibility', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...character, canGuess: false }]));
  assert.deepEqual(await api.getUniverseCharacterAvatarOptions('got'), [
    { id: 345, displayName: 'Little Sam', portraitUrl: '/images/sam.webp' },
  ]);
});
