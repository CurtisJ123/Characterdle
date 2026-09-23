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
let LeaderboardPage;
let EpisodeLadderLeaderboardTable;
let EpisodeLadderLeaderboardView;
let GameResultPanel;
let QuoteGameBoard;
let SiteHeader;
let DeferredContent;
let HistoryEduIcon;
let EpisodeLadderPortrait;
let EpisodeLadderView;
let CharacterGamePage;
let UniverseContext;
let LauncherPage;
let PublicPage;
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));

before(async () => {
  const bundle = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: 'error',
    plugins: [react(), {
      name: 'offline-navigation-tests',
      enforce: 'pre',
      // These render-only tests must not initialize an auth client or contact a database.
      resolveId(source) {
        if (/(^|\/)supabase(?:\.ts)?$/.test(source)) return '\0test-supabase';
        if (source.endsWith('/hooks/useAuth')) return '\0test-auth';
      },
      load(id) {
        if (id === '\0test-supabase') return 'export const supabase = {};';
        if (id === '\0test-auth') return 'export const useAuth = () => ({ user: null, session: null });';
      },
    }],
    ssr: { target: 'webworker', noExternal: true, resolve: { conditions: ['workerd', 'module', 'production'] } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { ssr: 'tests/fixtures/navigation.ts', write: false },
  });
  const entry = bundle.output.find(item => item.type === 'chunk' && item.isEntry);
  ({ createElement, renderToStaticMarkup, RouteLink, GameAction, PreviousGamesGrid, LeaderboardTable, LeaderboardPage, EpisodeLadderLeaderboardTable, EpisodeLadderLeaderboardView, GameResultPanel, QuoteGameBoard, SiteHeader, DeferredContent, HistoryEduIcon, EpisodeLadderPortrait, EpisodeLadderView, CharacterGamePage, UniverseContext, LauncherPage, PublicPage }
    = await import(`data:text/javascript;base64,${Buffer.from(`${entry.code}\n//# sourceURL=navigation-test-bundle.mjs`).toString('base64')}`));
});

const ladderRow = (overrides = {}) => ({
  userId: 'player', rank: 1, displayName: 'A Player', avatarUrl: null, showSupporterBadge: true,
  totalPoints: 100, daysPlayed: 2, pointsPerDay: 50, isCurrentUser: false, ...overrides,
});

test('Streaks is the first leaderboard tab and the default visible leaderboard', () => {
  const html = renderToStaticMarkup(createElement(UniverseContext.Provider,
    { value: { selectedUniverse: { id: 'got', title: 'Game of Thrones' } } }, createElement(LeaderboardPage)));
  assert.match(html, /aria-label="Leaderboard mode"><button class="is-active" type="button">Streaks<\/button><button class="" type="button">Character<\/button><button class="" type="button">Quote<\/button><button class="" type="button">Episode Ladder<\/button>/);
  assert.match(html, /Streak Overview/);
  assert.match(html, /Current Streak/);
  assert.doesNotMatch(html, /Episode Ladder Overview/);
});

test('Ladder leaderboard preserves backend ranks, integer points, averages, zero scores and premium avatars', () => {
  const html = render(EpisodeLadderLeaderboardTable, { rows: [
    ladderRow(), ladderRow({ userId: 'tied', rank: 1, displayName: 'Tied Player', pointsPerDay: 33.33, daysPlayed: 3 }),
    ladderRow({ userId: 'loss', rank: 2, totalPoints: 0, pointsPerDay: 0, daysPlayed: 1, isCurrentUser: true }),
  ] });
  for (const label of ['Total Points', 'Points per Day', 'Days Played']) assert.ok(html.includes(label));
  assert.equal((html.match(/class="rank-medal" role="cell">1</g) ?? []).length, 2);
  assert.match(html, />50\.00</);
  assert.match(html, />33\.33</);
  assert.match(html, />0\.00</);
  assert.match(html, /user-avatar--leaderboard is-premium/);
  assert.match(html, /is-current-user/);
  assert.doesNotMatch(html, /Character Wins|Avg\. Guesses|Attempts/);
});

test('Ladder leaderboard keeps personal standings in the shared table without extra panels or duplicate rows', () => {
  const top = ladderRow();
  const me = ladderRow({ userId: 'me', displayName: 'My Standing', rank: 72, isCurrentUser: true });
  const data = { overview: { playerCount: 80, totalPoints: 900, daysPlayed: 60, pointsPerDay: 15 }, rows: [top], currentUser: me };
  const html = render(EpisodeLadderLeaderboardView, { data, loading: false, error: null, onRetry: noop });
  assert.match(html, /Your Episode Ladder Standing/);
  assert.match(html, /class="rank-medal" role="cell">72</);
  assert.equal((html.match(/role="table"/g) ?? []).length, 1);
  assert.equal((html.match(/>My Standing</g) ?? []).length, 1);
  assert.match(html, /class="champion-avatar" aria-hidden="true">AP</);
  assert.equal((html.match(/class="champion-stat-card"/g) ?? []).length, 3);
  assert.equal((html.match(/class="metric-row"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /ladder-leaderboard|user-avatar--hero|card-kicker|Up to 100 points/);
  const inTop = render(EpisodeLadderLeaderboardView, { data: { ...data, rows: [top, me] }, loading: false, error: null, onRetry: noop });
  assert.equal(inTop, html);
});

test('Ladder leaderboard safely renders names and distinguishes empty, loading, and error states', () => {
  const row = ladderRow({ displayName: '<script>alert(1)</script>' });
  assert.doesNotMatch(render(EpisodeLadderLeaderboardTable, { rows: [row] }), /<script>/);
  const data = { overview: { playerCount: 0, totalPoints: 0, daysPlayed: 0, pointsPerDay: 0 }, rows: [], currentUser: null };
  assert.match(render(EpisodeLadderLeaderboardView, { data, loading: false, error: null, onRetry: noop }), /No entries yet/);
  assert.doesNotMatch(render(EpisodeLadderLeaderboardView, { data, loading: true, error: null, onRetry: noop }), /No entries yet/);
  assert.match(render(EpisodeLadderLeaderboardView, { data: null, loading: false, error: 'Unavailable', onRetry: noop }), /Try again/);
});

test('interactive and prerendered home pages link to daily Episode Ladder beside Play and Quote', () => {
  const interactive = renderToStaticMarkup(createElement(UniverseContext.Provider,
    { value: { selectedUniverse: { id: 'got', title: 'Game of Thrones' }, setSelectedUniverseId: noop } },
    createElement(LauncherPage, { accessToken: null, authError: null, isPremiumUser: false,
      isUserLoading: false, onNavigate: noop, onOpenGame: noop, user: null })));
  const prerendered = render(PublicPage, { route: { page: 'launcher', universeId: 'got', gameMode: 'character', gameId: null, authMode: 'login' } });
  for (const html of [interactive, prerendered]) {
    assert.match(html, /class="card-action-group"><a[^>]+href="\/got"[^>]*>Play<\/a><a[^>]+href="\/got\/game\/quote"[^>]*>Quote<\/a><a[^>]+href="\/got\/game\/episode_ladder"[^>]*>Episode Ladder<\/a>/);
    assert.equal((html.match(/href="\/got\/game\/episode_ladder"/g) ?? []).length, 1);
    assert.doesNotMatch(html, /href="\/(lotr|star-wars|wheel-of-time|cosmere)\/game\/episode_ladder"/);
  }
});

function ladderProps(status = 'playing', difficulty = 1, random = false) {
  const order = status === 'won' ? [1, 2, 3, 4, 5] : [5, 4, 3, 2, 1];
  const lockedPositions = status === 'won' ? [0, 1, 2, 3, 4] : [2];
  const game = {
    gameId: 93, difficulty, dateTime: '2026-06-01T04:00:00Z', maxAttempts: 4, status,
    initialOrder: [5, 4, 3, 2, 1], lockedPositions, solution: null,
    attempts: Array.from({ length: status === 'lost' ? 4 : 1 }, () => ({
      order, feedback: order.map((_, index) => lockedPositions.includes(index) ? 'correct' : 'incorrect'),
    })),
    events: [1, 2, 3, 4, 5].map(id => ({ id, description: `Event ${id}`, portraitUrl: null, characterName: null,
      episode: status === 'won' || id === 3 ? { seasonNumber: 2, episodeNumber: id, title: `Episode title ${id}` } : null,
    })),
  };
  return {
    selectedGameId: 93, selectedDifficulty: difficulty, premiumAccess: { practiceMode: true },
    onNavigate: noop, onOpenGame: noop, onOpenHistory: noop, onOpenRandomGame: noop,
    onSelectDifficulty: noop, onStartCheckout: noop, onNextRandomGame: random ? noop : undefined,
    ladder: { game, order, difficulties: ['won', 'pending', 'pending', 'pending', 'pending'],
      setOrder: noop, loading: false, submitting: false, error: null, locked: false, submit: noop, retry: noop },
  };
}

test('Ladder puts the game number in its title and only shows earned episode feedback', () => {
  const html = render(EpisodeLadderView, ladderProps());
  assert.match(html, /<p class="eyebrow">Game of Thrones<\/p><h1>Episode Ladder #93<\/h1>/);
  assert.match(html, /<span class="ladder-feedback">Season 2, Episode 3: Episode title 3<\/span>/);
  assert.equal((html.match(/class="ladder-feedback"/g) ?? []).length, 1);
  assert.match(html, /1 \/ 5 correct/);
  assert.match(html, /<i class="is-correct"><\/i>Correct<\/span>/);
  assert.doesNotMatch(html, /Five events\. Four attempts|Farther away|5 locked|Episode title [1245]/);
  assert.match(html, /href="\/got\/game\/character\/93"/);
  assert.match(html, /href="\/got\/game\/quote\/93"/);
});

for (const status of ['won', 'lost']) {
  test(`a ${status} Ladder has only the next difficulty action, not a result panel or daily replay`, () => {
    const html = render(EpisodeLadderView, ladderProps(status));
    assert.match(html, /class="ladder-completion-actions"><button[^>]+>Play Medium<\/button><\/div>/);
    assert.doesNotMatch(html, /ladder-result|ladder-solution|Check order|Play Character|Next Random Game/);
    const finalLevel = render(EpisodeLadderView, ladderProps(status, 5));
    assert.doesNotMatch(finalLevel, /ladder-completion-actions|Play undefined|Check order/);
  });
}

test('random Ladder retains the next practice round and the current-game back arrow', () => {
  const html = render(EpisodeLadderView, ladderProps('won', 5, true));
  assert.match(html, /class="game-top-actions"/);
  assert.match(html, /class="game-mode-links"/);
  assert.match(html, /Next Random Game/);
  assert.match(html, /class="current-game-icon"/);
  assert.match(html, /href="\/got\/game\/episode_ladder"/);
  assert.match(html, /href="\/got\/random\/quote"/);
  assert.match(html, /<h1>Random Episode Ladder<\/h1>/);
});

test('episode titles render as text rather than executable markup', () => {
  const props = ladderProps();
  props.ladder.game.events[2].episode.title = '<script>alert(1)</script>';
  const html = render(EpisodeLadderView, props);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

for (const mode of ['character', 'quote']) {
  for (const variant of ['archive', 'random']) {
    test(`${mode} ${variant} groups mode links for the shared toolbar and retains correct destinations`, () => {
      const html = renderToStaticMarkup(createElement(UniverseContext.Provider,
        { value: { selectedUniverse: { id: 'got', title: 'Game of Thrones' } } },
        createElement(CharacterGamePage, {
          selectedGameMode: mode, selectedGameId: variant === 'archive' ? 93 : null,
          gameVariant: variant, currentStreak: 0, premiumAccess: { practiceMode: true },
          gameStateOverride: { data: null, error: null, isLoading: false },
          onNavigate: noop, onOpenGame: noop, onOpenHistory: noop, onOpenRandomGame: noop, onStreakUpdated: noop,
        })));
      assert.match(html, /<nav class="game-top-actions" aria-label="Game modes">/);
      assert.match(html, /class="game-mode-links"/);
      assert.match(html, /<p class="eyebrow">Game of Thrones<\/p>/);
      assert.doesNotMatch(html, /Universe:/);
      if (variant === 'archive') {
        assert.match(html, /href="\/got\/game\/episode_ladder\/93"/);
        assert.match(html, new RegExp(`href="/got/game/${mode === 'character' ? 'quote' : 'character'}/93"`));
      } else {
        assert.match(html, /class="current-game-icon"/);
        assert.doesNotMatch(html, /episode-ladder-button/);
        assert.match(html, new RegExp(`href="${mode === 'character' ? '/got' : '/got/game/quote'}"`));
      }
    });
  }
}

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
  test(`Ladder table uses identical markup to ${gameMode}, changing only its labels and stats`, () => {
    const row = ladderRow({ isCurrentUser: true });
    const regular = render(LeaderboardTable, { mode: gameMode,
      rows: [{ ...row, wins: 100, averageGuesses: 50, plays: 2 }] });
    const ladder = render(EpisodeLadderLeaderboardTable, { rows: [row] });
    const normalizedLadder = ladder
      .replace('aria-label="Episode Ladder leaderboard"', 'aria-label="Global leaderboard"')
      .replace('Total Points', gameMode === 'quote' ? 'Quote Wins' : 'Character Wins')
      .replace('Points per Day', 'Avg. Guesses')
      .replace('Days Played', 'Attempts')
      .replace('>50.00<', '>50<');
    assert.equal(normalizedLadder, regular);
  });

  test(`${gameMode} leaderboard labels plays as Attempts without changing the displayed count`, () => {
    const html = render(LeaderboardTable, {
      mode: gameMode,
      rows: [{ userId: 'test-player', displayName: 'Test Player', avatarUrl: null,
        rank: 1, wins: 3, averageGuesses: 2, plays: 7, isCurrentUser: false, showSupporterBadge: false }],
    });
    assert.match(html, /<span role="columnheader">Attempts<\/span>/);
    assert.doesNotMatch(html, /<span role="columnheader">Plays<\/span>/);
    assert.match(html, /<strong role="cell">7<\/strong>/);
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

test('Ladder random entry uses the shared dice, label, and corner premium badge', () => {
  const props = ladderProps();
  props.premiumAccess.practiceMode = false;
  const html = render(EpisodeLadderView, props);
  assert.match(html, /random-game-button is-locked/);
  for (const className of ['random-game-icon-wrap', 'random-game-icon', 'random-game-label', 'random-game-lock']) {
    assert.ok(html.includes(`class="${className}"`));
  }
  assert.match(html, /Requires Premium/);
  assert.doesNotMatch(html, /ladder-random-entry|ladder-dice-lock/);
});

for (const authenticated of [false, true]) {
  test(`mobile header has a closed accessible menu and ${authenticated ? 'one' : 'no'} streak row`, () => {
    const html = render(SiteHeader, {
      currentPage: 'game', currentGameMode: 'episode_ladder', universeId: 'got', currentStreak: 12,
      isAuthenticated: authenticated, isPremiumLoading: false, isPremiumActive: false, isPremiumUser: false,
      isAdmin: authenticated, userDisplayName: authenticated ? 'Test Player' : undefined,
      onNavigate: noop, onAuthNavigate: noop,
    });
    assert.match(html, /aria-label="Open navigation menu" aria-expanded="false" aria-controls="([^"]+)"/);
    assert.match(html, /class="mobile-header-menu" id="[^"]+" hidden=""/);
    assert.match(html, /aria-label="Mobile navigation"/);
    assert.match(html, /href="\/got\/archive\/episode_ladder"/);
    assert.equal((html.match(/class="streak-badge"/g) ?? []).length, authenticated ? 1 : 0);
    if (authenticated) {
      assert.match(html, /mobile-profile-link/);
      assert.match(html, /href="\/admin"/);
      assert.match(html, />Settings<\/button>/);
    } else {
      assert.match(html, />Log in<\/button>/);
      assert.match(html, />Sign up<\/button>/);
    }
  });
}
