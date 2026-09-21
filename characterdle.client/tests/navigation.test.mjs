import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

let createElement;
let renderToStaticMarkup;
let RouteLink;
let GameAction;
let PreviousGamesGrid;
let GameResultPanel;
let QuoteGameBoard;
let SiteHeader;
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

before(async () => {
  const bundle = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: 'error',
    plugins: [react(), {
      name: 'offline-navigation-tests',
      enforce: 'pre',
      // These render-only tests must not initialize an auth client or contact a database.
      resolveId(source) { if (/(^|\/)supabase(?:\.ts)?$/.test(source)) return '\0test-supabase'; },
      load(id) { if (id === '\0test-supabase') return 'export const supabase = {};'; },
    }],
    ssr: { target: 'webworker', noExternal: true, resolve: { conditions: ['workerd', 'module', 'production'] } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { ssr: 'tests/fixtures/navigation.ts', write: false },
  });
  const entry = bundle.output.find(item => item.type === 'chunk' && item.isEntry);
  ({ createElement, renderToStaticMarkup, RouteLink, GameAction, PreviousGamesGrid, GameResultPanel, QuoteGameBoard, SiteHeader }
    = await import(`data:text/javascript;base64,${Buffer.from(`${entry.code}\n//# sourceURL=navigation-test-bundle.mjs`).toString('base64')}`));
});

test('route links expose href, label, and existing styling without JavaScript', () => {
  const html = render(RouteLink, { href: '/got', className: 'primary-button', children: 'Play', onNavigate: noop });
  assert.match(html, /<a class="route-link primary-button" href="\/got">Play<\/a>/);
});

test('random regeneration actions remain buttons while page actions become links', () => {
  assert.match(render(GameAction, { className: 'primary-button', children: 'Another Random Game', onClick: noop }), /<button[^>]+type="button"/);
  assert.match(render(GameAction, { className: 'primary-button', children: 'Play Quote', href: '/got/game/quote/50', onClick: noop }), /<a[^>]+href="\/got\/game\/quote\/50"/);
});

for (const gameMode of ['character', 'quote']) {
  test(`${gameMode} archive exposes only playable tiles as links`, () => {
    const html = render(PreviousGamesGrid, {
      accessibleGameCount: 1, currentGameId: 50, gameMode,
      games: [50, 49, 48].map(id => ({ id, dateTime: '2026-09-20T00:00:00Z' })),
      gameOutcomes: new Map(), onOpenGame: noop, universeTitle: 'Game of Thrones', universeId: 'got',
    });
    assert.ok(html.includes(`href="${gameMode === 'quote' ? '/got/game/quote' : '/got'}"`));
    assert.ok(html.includes(`href="/got/game/${gameMode}/49"`));
    assert.equal((html.match(/<a /g) ?? []).length, 2);
    assert.match(html, /<button[^>]+is-locked[^>]+disabled=""/);
    assert.ok(!html.includes(`href="/got/game/${gameMode}/48"`));
  });
}

test('premium archive access keeps every tile available as a link', () => {
  const html = render(PreviousGamesGrid, {
    accessibleGameCount: Number.MAX_SAFE_INTEGER, currentGameId: 50, gameMode: 'character',
    games: [50, 49, 48].map(id => ({ id, dateTime: '2026-09-20T00:00:00Z' })),
    gameOutcomes: new Map(), onOpenGame: noop, universeTitle: 'Game of Thrones', universeId: 'got',
  });
  assert.equal((html.match(/<a /g) ?? []).length, 3);
  assert.ok(!html.includes('<button'));
});

for (const status of ['won', 'lost']) {
  test(`${status} character results link to the matching quote and leaderboard`, () => {
    const html = render(GameResultPanel, {
      status, answerName: 'Preview', averageGuesses: 3, guessCount: 3, hintCount: 0, playCount: 1,
      primaryActionLabel: 'Play Quote', primaryActionHref: '/got/game/quote/50', onPrimaryAction: noop,
      secondaryActionLabel: 'Leaderboard', secondaryActionHref: '/got/leaderboard', onSecondaryAction: noop,
    });
    assert.match(html, /<a[^>]+href="\/got\/game\/quote\/50"/);
    assert.match(html, /<a[^>]+href="\/got\/leaderboard"/);
  });
}

test('quote results link back to the matching character game', () => {
  const html = render(QuoteGameBoard, {
    status: 'won', answerName: 'Preview', completedGameStats: { averageGuesses: 2, playCount: 1 },
    currentStreak: 0, gameId: 50, guessCount: 2, hintCount: 0, rows: [], quoteText: 'Preview',
    universeId: 'got', universeName: 'Game of Thrones', showShareButton: false,
    primaryActionLabel: 'Play Character Game', primaryActionHref: '/got/game/character/50', onPrimaryAction: noop,
    onViewLeaderboard: noop,
  });
  assert.match(html, /<a[^>]+href="\/got\/game\/character\/50"/);
});

test('header links preserve archive mode and Updates remains a popup button', () => {
  const html = render(SiteHeader, {
    currentPage: 'game', currentGameMode: 'quote', universeId: 'got', currentStreak: 0,
    isAuthenticated: false, isPremiumLoading: false, isPremiumActive: false, isPremiumUser: false,
    onNavigate: noop, onAuthNavigate: noop,
  });
  assert.match(html, /<a[^>]+href="\/home"/);
  assert.match(html, /<a[^>]+href="\/got\/archive\/quote"/);
  assert.match(html, /<a[^>]+href="\/got\/leaderboard"/);
  assert.match(html, /<button class="updates-header-button"[^>]+aria-haspopup="dialog"/);
});
