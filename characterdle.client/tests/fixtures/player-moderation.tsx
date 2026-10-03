// Isolated synthetic UI fixture. No external services or real accounts.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminPlayers } from '../../src/components/admin/AdminPlayers';
import type { AdminPlayerProfile } from '../../src/types/admin';
import type { PlayerModerationState, SavePlayerModeration } from '../../src/types/playerModeration';
import '../../src/index.css';
import '../../src/App.css';
import '../../src/pages/AdminPage.css';
window.__CHARACTERDLE_PUBLIC_CONFIG__ = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '' };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const profiles: AdminPlayerProfile[] = Array.from({ length: 45 }, (_, i) => ({
  id: id(i + 1), displayName: `Player ${i + 1}`, email: `player${i + 1}@example.invalid`, avatarUrl: null,
  createdAt: '2026-09-01T12:00:00Z', membership: 'Premium', lastPlayedAt: '2026-10-01T12:00:00Z',
  currentStreak: 20, longestStreak: 22, characterAttempts: 30, characterWins: 28, characterWinRate: 93.33,
  characterAverageGuesses: 3, quoteAttempts: 30, quoteWins: 29, quoteWinRate: 96.67, quoteAverageGuesses: 2,
  ladderPoints: 125, ladderDaysPlayed: 2, ladderPointsPerDay: 62.5, moderationStatus: 'Normal',
}));
const states = new Map<string, PlayerModerationState>();
const normal = (): PlayerModerationState => ({ state: 'normal', isRestricted: false, reason: '', expiresAt: null, updatedAt: null, updatedBy: null, revision: 0, guestLinks: [] });
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.origin); const path = url.pathname;
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (path === '/api/admin/players') return json(profiles);
  if (path.startsWith('/api/admin/players/guest/')) return json({ guestId: path.split('/').at(-1), recordedGames: 12, completedGames: 10,
    lastPlayedAt: '2026-10-01T11:59:00Z', linkedUserId: id(44), linkedDisplayName: 'Player 44', linkedRevision: 3 });
  const match = path.match(/^\/api\/admin\/players\/([^/]+)(?:\/(.+))?$/);
  if (!match) return json({}, 404);
  const profile = profiles.find(p => p.id === match[1]); if (!profile) return json({}, 404);
  const state = states.get(profile.id) ?? normal();
  if (!match[2]) return json({ profile, moderation: state, isAdmin: false, canRestrict: true, ladderFirstAttemptWinRate: 60,
    billing: { status: 'active', currentPeriodStart: '2026-09-01T12:00:00Z', currentPeriodEnd: '2026-10-01T12:00:00Z', cancelAtPeriodEnd: false, cancelAt: null } });
  if (match[2] === 'moderation' && options?.method === 'PUT') {
    const body = JSON.parse(String(options.body)) as SavePlayerModeration;
    if (location.search.includes('conflict')) return json({ detail: 'This player changed. Reload and review.' }, 409);
    const next = { ...state, ...body, isRestricted: body.state === 'shadow_banned', revision: state.revision + 1, updatedBy: id(999), updatedAt: new Date().toISOString(),
      guestLinks: body.guestIds.map(guestId => ({ guestId, linkedAt: new Date().toISOString(), linkedBy: id(999) })) };
    states.set(profile.id, next); profile.moderationStatus = next.isRestricted ? 'Shadow Banned' : 'Normal';
    document.querySelector('output')!.textContent = JSON.stringify(body);
    return json(next);
  }
  if (match[2] === 'moderation-history') return json({ items: [], page: 1, hasNextPage: false });
  if (match[2] === 'games') return json({ items: [{ universeId: 'got', gameId: 93, mode: 'episode_ladder', status: 'won', guessCount: 2, hintCount: 0,
    completedAt: '2026-10-01T12:00:00Z', difficulty: 1, points: 6, dailyPoints: 60, attempts: [[1, 2, 3, 5, 4], [1, 2, 3, 4, 5]] }], page: 1, hasNextPage: false });
  return json({ history: { items: [{ universeId: 'got', gameId: 93, mode: 'episode_ladder', status: 'won', guessCount: 2, completedAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z', guestKey: `guest:${id(101)}`, guestStatus: 'won', guestGuessCount: 1, guestCompletedAt: '2026-10-01T11:59:00Z', secondsBefore: 60 }], page: 1, hasNextPage: false },
    repeatedGuests: [{ guestKey: `guest:${id(101)}`, matches: 12, lastMatchAt: '2026-10-01T11:59:00Z' }] });
};
createRoot(document.getElementById('root')!).render(<StrictMode><output aria-label="Last moderation payload" />
  <main className="updates-page admin-page"><AdminPlayers token="fixture" /></main></StrictMode>);
