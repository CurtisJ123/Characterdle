// In-memory UI fixture: no credentials, database, or external API requests.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminPage } from '../../src/pages/AdminPage';
import type { AdminCharacter, AdminQuote } from '../../src/types/adminCatalog';
import type { AdminPlayerProfile } from '../../src/types/admin';
import '../../src/index.css';
import '../../src/App.css';

window.__CHARACTERDLE_PUBLIC_CONFIG__ = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '' };
let characters: AdminCharacter[] = Array.from({ length: 26 }, (_, i) => ({
  id: i + 1, version: '123', displayName: ['Arya Stark', 'Jon Snow', 'Tyrion Lannister'][i % 3] + (i < 3 ? '' : ` ${i + 1}`),
  aliases: i === 0 ? ['Arry', 'No One'] : [], gender: i % 3 === 0 ? 'Female' : 'Male', species: 'Human',
  house: [i % 3 === 2 ? 'House Lannister' : 'House Stark'], occupation: ['Lord', 'Small Council'],
  debutSeason: 1, lastSeason: 8, alive: i % 2 === 0, portraitUrl: '/images/test.png',
}));
let quotes: AdminQuote[] = [
  { id: 1, version: '123', characterId: 1, quoteText: 'Not today.', seasonNumber: 1, episodeNumber: 2, episodeTitleId: 2 },
  { id: 2, version: '123', characterId: 3, quoteText: 'Never forget what you are. The rest of the world will not.', seasonNumber: 1, episodeNumber: 1, episodeTitleId: 1 },
  { id: 3, version: '123', characterId: 2, quoteText: '<script>alert("not executed")</script>', seasonNumber: 1, episodeNumber: 1, episodeTitleId: null },
];
const episodes = [{ id: 1, seasonNumber: 1, episodeNumber: 1, title: 'Winter Is Coming' },
  { id: 2, seasonNumber: 1, episodeNumber: 2, title: 'The Kingsroad' }];
const players: AdminPlayerProfile[] = Array.from({ length: 45 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  displayName: i === 0 ? '<script>alert("not executed")</script>' : `Player ${i + 1}`,
  email: `player${i + 1}@example.invalid`, avatarUrl: null,
  createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
  membership: i % 3 === 0 ? 'Premium' : i % 3 === 1 ? 'Trial' : 'Free',
  lastPlayedAt: i === 44 ? null : '2026-09-24T12:00:00Z', currentStreak: i, longestStreak: i + 5,
  characterAttempts: i * 3, characterWins: i, characterWinRate: i ? 33.33 : 0, characterAverageGuesses: i ? 2.5 : null,
  quoteAttempts: i * 2, quoteWins: i, quoteWinRate: i ? 50 : 0, quoteAverageGuesses: i ? 3 : null,
  ladderPoints: i * 19, ladderDaysPlayed: i, ladderPointsPerDay: i ? 19 : 0,
}));
let saves = 0;
let lastBody = '';
const creations = new Map<string, AdminCharacter | AdminQuote>();
let lostResponse = false;
window.fetch = async (input, options) => {
  const path = new URL(String(input), location.origin).pathname;
  const method = options?.method ?? 'GET';
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (path === '/api/admin/access') return json({ isAdmin: true });
  if (path === '/api/admin/players') return json(players);
  if (path === '/api/admin/comments') return json({ page: 1, hasNextPage: false, items: [
    { id: 'ladder-comment', source: 'game', contextTitle: 'GOT / Episode Ladder #94', contextUrl: '/got/game/episode_ladder/94',
      displayName: 'Player 1', avatarUrl: null, body: 'Loved the new mode.', createdAt: '2026-09-24T12:00:00Z', isHidden: false, canModerate: false },
  ] });
  if (path === '/api/admin/dashboard') return json({ generatedAt: '2026-09-18T12:00:00Z', activitySince: '2026-09-11T12:00:00Z',
    profiles: 135, newProfiles: 5, accountsWithCompletedGames: 113, premium: { users: 9, trialUsers: 6, activeSubscriptions: 2, pastDueSubscriptions: 1 },
    players: { uniquePlayers: 228, activePlayers: 120, startedGames: 500, completedGames: 410 } });
  if (path === '/api/admin/got/characters' && method === 'GET') return json(characters);
  if (path === '/api/admin/got/quotes' && method === 'GET') return json(quotes);
  if (path === '/api/admin/got/options') return json({ characters: characters.map(r => ({ id: r.id, displayName: r.displayName })), episodes });
  if (method === 'POST' && (path === '/api/admin/got/characters' || path === '/api/admin/got/quotes')) {
    saves++;
    const body = JSON.parse(String(options?.body));
    lastBody = JSON.stringify({ ...body, ...(body.portrait ? { portrait: { contentType: body.portrait.contentType, data: `${body.portrait.data.length} base64 characters` } } : {}) });
    window.dispatchEvent(new Event('fixture-save'));
    await new Promise(resolve => setTimeout(resolve, 250));
    if (creations.has(body.requestId)) return json(creations.get(body.requestId), 201);
    let row: AdminCharacter | AdminQuote;
    if (path.endsWith('/characters')) {
      row = { ...body.character, id: Math.max(...characters.map(c => c.id)) + 1, version: '125',
        portraitUrl: body.portrait ? '/images/GOTCharacterImages/aeron-greyjoy.webp' : body.character.portraitUrl };
      characters = [...characters, row as AdminCharacter];
    } else {
      const q = body.quote;
      if (q.episodeTitleId !== null && !episodes.some(e => e.id === q.episodeTitleId && e.seasonNumber === q.seasonNumber && e.episodeNumber === q.episodeNumber))
        return json({ detail: 'Episode title must match the selected season and episode.' }, 400);
      row = { ...q, id: Math.max(...quotes.map(q => q.id)) + 1, version: '125' };
      quotes = [...quotes, row as AdminQuote];
    }
    creations.set(body.requestId, row);
    if (new URLSearchParams(location.search).get('lostResponse') === '1' && !lostResponse) {
      lostResponse = true; throw new TypeError('Simulated lost response. Retry Save.');
    }
    return json(row, 201);
  }
  const match = path.match(/^\/api\/admin\/got\/(characters|quotes)\/(\d+)$/);
  if (match && method === 'PUT') {
    saves++; lastBody = String(options?.body); window.dispatchEvent(new Event('fixture-save'));
    await new Promise(resolve => setTimeout(resolve, 250));
    if (new URLSearchParams(location.search).get('conflict') === '1') return json({ detail: 'This row changed or was removed. Discard your edit and refresh before trying again.' }, 409);
    const body = JSON.parse(lastBody), id = Number(match[2]);
    if (match[1] === 'characters') {
      const row = { ...characters.find(r => r.id === id)!, ...body, id, version: String(123 + saves) };
      characters = characters.map(r => r.id === id ? row : r); return json(row);
    }
    if (body.episodeTitleId !== null && !episodes.some(e => e.id === body.episodeTitleId && e.seasonNumber === body.seasonNumber && e.episodeNumber === body.episodeNumber))
      return json({ detail: 'Episode title must match the selected season and episode.' }, 400);
    const row = { ...quotes.find(r => r.id === id)!, ...body, id, version: String(123 + saves) };
    quotes = quotes.map(r => r.id === id ? row : r); return json(row);
  }
  return json({}, 404);
};
export function Fixture() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const changed = () => rerender(v => v + 1);
    window.addEventListener('fixture-save', changed);
    return () => window.removeEventListener('fixture-save', changed);
  }, []);
  return <><output aria-label="Fixture save count">Save requests: {saves}</output>
    <details><summary>Last save payload</summary><pre>{lastBody}</pre></details>
    <AdminPage token="fixture-admin" onLogin={() => undefined} /></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
