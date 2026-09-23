import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

let createElement;
let renderToStaticMarkup;
let RouteLink;
let GameAction;
let PreviousGamesGrid;
let LeaderboardTable;
let GameResultPanel;
let QuoteGameBoard;
let SiteHeader;
let DeferredContent;
let HistoryEduIcon;
let EpisodeLadderPortrait;
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
  ({ createElement, renderToStaticMarkup, RouteLink, GameAction, PreviousGamesGrid, LeaderboardTable, GameResultPanel, QuoteGameBoard, SiteHeader, DeferredContent, HistoryEduIcon, EpisodeLadderPortrait }
    = await import(`data:text/javascript;base64,${Buffer.from(`${entry.code}\n//# sourceURL=navigation-test-bundle.mjs`).toString('base64')}`));
});

test('Ladder events without a character reserve a portrait slot with a decorative question mark', () => {
  const html = render(EpisodeLadderPortrait, { event: { characterName: null, portraitUrl: null } });
  assert.match(html, /<span class="ladder-portrait"><svg class="history-avatar ladder-portrait-placeholder"/);
  assert.match(html, /viewBox="0 0 52 68" aria-hidden="true" focusable="false"/);
  assert.match(html, /<path[^>]+stroke="#c5a158"/);
  assert.doesNotMatch(html, /<img|undefined|src=/);
});

test('Ladder events with characters retain their existing portrait rendering', () => {
  const html = render(EpisodeLadderPortrait, { event: { characterName: 'Jon Snow', portraitUrl: '/images/GOTCharacterImages/jon-snow.webp' } });
  assert.match(html, /<span class="ladder-portrait"><img class="history-avatar"/);
  assert.match(html, /src="\/images\/GOTCharacterImages\/jon-snow.webp"/);
  assert.doesNotMatch(html, /ladder-portrait-placeholder/);
});

test('the empty-game icon is decorative inline SVG without an icon font dependency', () => {
  const html = render(HistoryEduIcon, { className: 'empty-guess-state-mark' });
  assert.match(html, /<svg class="empty-guess-state-mark"/);
  assert.match(html, /viewBox="0 -960 960 960"/);
  assert.match(html, /fill="currentColor"/);
  assert.match(html, /aria-hidden="true" focusable="false"/);
  assert.match(html, /<path d="M320-160/);
  assert.doesNotMatch(html, /<text|<use|href=|material-symbols|history_edu/);
});

test('deferred content adds no visible placeholder while a child is loading', () => {
  const pending = new Promise(() => {});
  const PendingContent = () => { throw pending; };
  const html = render(DeferredContent, { children: createElement(PendingContent) });
  assert.equal(html.replace(/<!--[\s\S]*?-->/g, ''), '');
});

test('deferred content renders loaded children normally', () => {
  const html = render(DeferredContent, { children: createElement('div', { role: 'dialog' }, 'Settings') });
  assert.match(html, /<div role="dialog">Settings<\/div>/);
});

test('route links expose href, label, and existing styling without JavaScript', () => {
  const html = render(RouteLink, { href: '/got', className: 'primary-button', children: 'Play', onNavigate: noop });
  assert.match(html, /<a class="route-link primary-button" href="\/got">Play<\/a>/);
});

test('random regeneration actions remain buttons while page actions become links', () => {
  assert.match(render(GameAction, { className: 'primary-button', children: 'Another Random Game', onClick: noop }), /<button[^>]+type="button"/);
  assert.match(render(GameAction, { className: 'primary-button', children: 'Play Quote', href: '/got/game/quote/50', onClick: noop }), /<a[^>]+href="\/got\/game\/quote\/50"/);
});

test('Episode Ladder archive keeps its own links and does not promise Character/Quote replays', () => {
  const html = render(PreviousGamesGrid, {
    accessibleGameCount: 100, currentGameId: 50, gameMode: 'episode_ladder',
    games: [50, 49].map(id => ({ id, dateTime: '2026-09-20T00:00:00Z' })),
    gameOutcomes: new Map([[50, 'won'], [49, 'lost']]), onOpenGame: noop,
    universeTitle: 'Game of Thrones', universeId: 'got',
  });
  assert.match(html, /href="\/got\/game\/episode_ladder"/);
  assert.match(html, /href="\/got\/game\/episode_ladder\/49"/);
  assert.match(html, /Finished without solving/);
  assert.doesNotMatch(html, /30 days|Gave up|without hints/);
});

for (const gameMode of ['character', 'quote']) {
  test(`${gameMode} leaderboard labels plays as Attempts without changing the displayed count`, () => {
    const html = render(LeaderboardTable, {
      mode: gameMode,
      rows: [{ userId: 'test-player', displayName: 'Test Player', avatarUrl: null,
        rank: 1, wins: 3, averageGuesses: 2, plays: 7, isCurrentUser: false, showSupporterBadge: false }],
    });
    assert.match(html, /<span>Attempts<\/span>/);
    assert.doesNotMatch(html, /<span>Plays<\/span>/);
    assert.match(html, /<strong>7<\/strong>/);
  });

  test(`${gameMode} archive distinguishes hinted wins without changing tile destinations`, () => {
    const html = render(PreviousGamesGrid, {
      accessibleGameCount: 100, currentGameId: 50, gameMode,
      games: [50, 49, 48, 47].map(id => ({ id, dateTime: '2026-09-20T00:00:00Z' })),
      gameOutcomes: new Map([[50, 'won-with-hints'], [49, 'won'], [48, 'lost'], [47, 'pending']]),
      onOpenGame: noop, universeTitle: 'Game of Thrones', universeId: 'got',
    });
    assert.match(html, /class="[^"]*is-hinted-win/);
    assert.match(html, /Solved with hints\. Replay available 30 days after completion\./);
    for (const state of ['is-completed', 'is-given-up', 'is-pending']) assert.ok(html.includes(state));
    assert.equal((html.match(/<a /g) ?? []).length, 4);
  });

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
