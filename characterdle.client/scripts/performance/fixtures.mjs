// Synthetic local-only game data, never read from an account or live service.
const character = (id, displayName, slug, overrides = {}) => ({
  id, displayName, aliases: [], portraitUrl: `/images/GOTCharacterImages/${slug}.webp`,
  attributes: {
    species: 'Human', gender: 'Male', house: ['House Stark'], occupation: ['Lord'],
    debutSeason: 1, lastSeason: 1, alive: false, ...overrides,
  },
});

const characters = [
  character(1, 'Eddard Stark', 'eddard-stark'),
  character(2, 'Roslin Frey', 'roslin-frey', { gender: 'Female', house: ['House Frey'], occupation: ['Lady'], debutSeason: 3, lastSeason: 6, alive: true }),
  character(3, 'Qhorin Halfhand', 'qhorin-halfhand', { house: [], occupation: ['Ranger'], debutSeason: 2, lastSeason: 2 }),
  character(4, 'Jon Snow', 'jon-snow', { occupation: ['Ranger'], lastSeason: 8, alive: true }),
  character(5, 'Daenerys Targaryen', 'daenerys-targaryen', { gender: 'Female', house: ['House Targaryen'], occupation: ['Queen'], lastSeason: 8 }),
];

export const game = {
  id: 900001, dateTime: '2026-09-21T00:00:00Z', universeId: 'got', universeName: 'Game of Thrones',
  answerCharacter: characters[0], characters,
  characterStats: { averageGuessSampleSize: 4, averageGuesses: 4, playCount: 5 },
  quoteStats: { averageGuessSampleSize: 4, averageGuesses: 4, playCount: 5 },
  attributeDefinitions: [
    { key: 'species', label: 'Species', kind: 'string' },
    { key: 'gender', label: 'Gender', kind: 'string' },
    { key: 'house', label: 'Houses', kind: 'list', emptyLabel: 'None' },
    { key: 'occupation', label: 'Roles', kind: 'list', emptyLabel: 'None' },
    { key: 'debutSeason', label: 'Debut Season', kind: 'number' },
    { key: 'lastSeason', label: 'Last Season', kind: 'number' },
    { key: 'alive', label: 'Status', kind: 'boolean', trueLabel: 'Alive', falseLabel: 'Dead' },
  ],
  quotePrompt: { id: 900001, characterId: 1, seasonNumber: 1, episodeNumber: 1,
    episodeTitle: 'Benchmark episode', text: 'This is a local benchmark quote, not a real daily game.' },
};

export const savedProgress = {
  completionRecorded: false, firstLetterRevealed: false, gaveUp: false, guessCount: 3,
  guessedCharacterIds: [4, 3, 2], revealedHintKeys: [],
  resolvedAt: null, updatedAt: '2026-09-21T12:00:00Z',
};

export const announcement = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'benchmark-update', title: 'Local benchmark update',
  summary: 'A synthetic update for offline UI validation.',
  bodyMarkdown: '## Streak icons\n\nThis is a **local test** of the updates dialog.\n\n- First item\n- Second item\n\n[How to play](/how-to-play)',
  status: 'published', showPopup: false, publishedAt: '2026-09-21T12:00:00Z', updatedAt: '2026-09-21T12:00:00Z',
};

export const scenarios = [
  { name: 'landing', pathname: '/', readySelector: '#root:not([data-prerendered]) .landing-shell[aria-busy="false"]' },
  { name: 'character', pathname: '/got', readySelector: '.search-box input:not(:disabled)' },
  { name: 'quote', pathname: '/got/game/quote', readySelector: '.search-box input:not(:disabled)' },
  { name: 'character-progress', pathname: '/got', progressMode: 'character', readySelector: '.search-box input:not(:disabled)' },
  { name: 'quote-progress', pathname: '/got/game/quote', progressMode: 'quote', readySelector: '.search-box input:not(:disabled)' },
];

export function apiFixture(pathname, method) {
  if (method === 'GET' && pathname === '/api/status') return { status: 200 };
  if (method === 'GET' && pathname === '/api/universes/got/games/current') return { status: 200, body: game };
  if (method === 'GET' && pathname === '/api/updates/latest') return { status: 200, body: { post: null, seen: true } };
  if (method === 'GET' && pathname === '/api/updates/current') return { status: 200, body: { post: announcement } };
  if (method === 'GET' && pathname === '/api/updates') return { status: 200, body: { items: [], page: 1, hasNextPage: false } };
  if (method === 'GET' && pathname === `/api/updates/${announcement.id}/comments`) return { status: 200, body: { items: [], page: 1, hasNextPage: false } };
  if (method === 'POST' && pathname === `/api/universes/got/games/${game.id}/plays`) return { status: 204 };
  return null;
}
