// Open with ?auth=member, ?auth=guest, or ?auth=loading on a separate local Vite port.
// Exercise the real App/AuthProvider, but never send requests to a backend or Supabase.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { UniverseProfile } from '../../src/types/profile';
import type { PremiumAccess } from '../../src/types/premium';
import '../../src/index.css';

if (!import.meta.env.DEV) throw new Error('This fixture is local-only.');
const scenario = new URLSearchParams(location.search).get('auth') ?? 'member';
window.__CHARACTERDLE_PUBLIC_CONFIG__ = {
  supabaseUrl: 'https://landing-fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '',
};
const userId = '00000000-0000-4000-8000-000000000001';
const modeStats = { wins: 14, plays: 15, losses: 1, averageGuesses: 3, averageHints: 0, completionRate: 93, rank: 1 };
const profile: UniverseProfile = {
  universeId: 'got', universeName: 'Game of Thrones', userId, displayName: 'Fixture Player',
  email: 'fixture@example.test', avatarUrl: '/android-chrome-512x512.png', memberSince: '2026-09-01T00:00:00Z',
  totalWins: 28, totalPlays: 30, totalLosses: 2, totalCompletionRate: 93, averageGuesses: 3, overallRank: 1,
  currentStreak: 14, longestStreak: 14, character: { mode: 'character', ...modeStats },
  quote: { mode: 'quote', ...modeStats }, recentResults: [],
};
const access: PremiumAccess = {
  isPremium: true, planCode: 'monthly', subscriptionStatus: 'active', billedPriceCents: 399, currencyCode: 'usd',
  currentPeriodStart: null, currentPeriodEnd: null, cancelAt: null, cancelAtPeriodEnd: false, billingDiscountCode: null,
  adFree: true, practiceMode: true, profileCustomization: true, supporterBadge: true, fullArchiveAccess: true,
  archiveLookbackDays: 7, streakProtection: true, streakSaversPerCycle: 1, availableStreakSavers: 1, autoUseStreakSavers: true,
};
window.fetch = async (input, options) => {
  const request = input instanceof Request ? input : null;
  const url = new URL(request?.url ?? String(input), location.origin);
  const method = options?.method ?? request?.method ?? 'GET';
  const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
  if (url.origin !== location.origin || method !== 'GET') throw new Error(`Fixture blocked request: ${method} ${url}`);
  if (url.pathname === '/api/updates/latest') return json({ post: null, seen: true });
  if (url.pathname === '/api/updates/current') return json({ post: null });
  if (url.pathname === '/api/admin/access') return json({ isAdmin: false });
  if (url.pathname === '/api/profile/got') return json(profile);
  if (url.pathname === '/api/profile/got/results') return json([]);
  if (url.pathname === '/api/premium') return json({ access });
  if (url.pathname === '/api/universes/got/leaderboard/') {
    const overview = { playerCount: 1, totalPlays: 30, totalWins: 28, totalCharacterWins: 14, totalQuoteWins: 14, averageGuesses: 3 };
    return json({ universeId: 'got', universeName: 'Game of Thrones', overview, characterOverview: overview,
      quoteOverview: overview, currentUser: null, rows: [], currentUserStreak: null, streakRows: [] });
  }
  throw new Error(`Unexpected fixture request: ${url.pathname}`);
};

const { supabase } = await import('../../src/lib/supabase');
let session: Session | null = scenario === 'guest' ? null : {
  access_token: 'fixture-token', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
  user: { id: userId, aud: 'authenticated', email: profile.email, created_at: profile.memberSince,
    app_metadata: {}, user_metadata: { display_name: profile.displayName, avatar_url: profile.avatarUrl } },
};
const ready = scenario === 'loading' ? new Promise<void>((resolve) => {
  const button = document.querySelector<HTMLButtonElement>('#restore-session')!;
  button.hidden = false;
  button.onclick = () => { button.hidden = true; resolve(); };
}) : Promise.resolve();
supabase.auth.getSession = async () => {
  await ready;
  return session ? { data: { session }, error: null } : { data: { session: null }, error: null };
};
let onAuthChange: ((event: AuthChangeEvent, session: Session | null) => void | Promise<void>) | undefined;
supabase.auth.onAuthStateChange = (callback) => {
  onAuthChange = callback;
  return { data: { subscription: { id: 'fixture', callback, unsubscribe: () => { onAuthChange = undefined; } } } };
};
supabase.auth.signOut = async () => {
  session = null;
  await onAuthChange?.('SIGNED_OUT', null);
  return { error: null };
};

const { default: App } = await import('../../src/App');
const { AuthProvider } = await import('../../src/contexts/AuthContext');
const { UniverseProvider } = await import('../../src/contexts/UniverseContext');
createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthProvider><UniverseProvider><App /></UniverseProvider></AuthProvider></StrictMode>,
);
