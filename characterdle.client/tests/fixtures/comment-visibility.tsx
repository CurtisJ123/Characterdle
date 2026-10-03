import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PostComments } from '../../src/components/updates/PostComments';
import { GameComments } from '../../src/components/game/GameComments';

window.__CHARACTERDLE_PUBLIC_CONFIG__ = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '' };
const linkedGuest = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
localStorage.setItem('episode-ladder-guest-id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
let restricted = false, failing = false, elapsed = 0;
const realNow = Date.now;
Date.now = () => realNow() + elapsed;
const comments = [
  { id: 'regular', displayName: 'Regular player', body: 'Visible regular comment', user: 'regular' },
  { id: 'restricted', displayName: 'Restricted player', body: 'Restricted player comment', user: 'restricted' },
];
function refresh() { elapsed += 46_000; window.dispatchEvent(new Event('focus')); }
window.fetch = async (input, options) => {
  const path = String(input);
  if (!path.includes('/comments')) throw new Error(`Unexpected fixture request: ${path}`);
  const headers = new Headers(options?.headers);
  const user = headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  const visibility = user ?? (headers.get('X-Leaderboard-Guest-Id') === linkedGuest ? 'restricted' : null);
  const game = path.includes('/universes/');
  await new Promise(resolve => setTimeout(resolve, 200));
  if (failing) return Response.json({}, { status: 503 });
  if (options?.method === 'POST') {
    const body = JSON.parse(options.body as string).body as string;
    comments.push({ id: 'posted', displayName: 'Restricted player', body, user: user! });
    return Response.json({}, { status: 201 });
  }
  const items = comments.filter(c => !restricted || c.user !== 'restricted' || visibility === c.user).map(c => ({
    ...c, avatarUrl: null, createdAt: '2026-10-03T12:00:00Z', showSupporterBadge: false,
    announcementId: 'test-post', postTitle: 'Post', postSlug: 'post', isOwn: c.user === user, isHidden: false,
  }));
  return Response.json(game ? { comments: items, page: 1, hasNextPage: false } : { items, page: 1, hasNextPage: false });
};
function Fixture() {
  const [user, setUser] = useState<string | null>('regular');
  return <>
    <nav aria-label="Fixture controls">
      <button onClick={() => { restricted = true; refresh(); }}>Restrict</button>
      <button onClick={() => { restricted = false; refresh(); }}>Unrestrict</button>
      <button onClick={() => setUser('restricted')}>Restricted account</button>
      <button onClick={() => setUser('regular')}>Regular account</button>
      <button onClick={() => setUser(null)}>Guest</button>
      <button onClick={() => { localStorage.setItem('episode-ladder-guest-id', linkedGuest); window.dispatchEvent(new Event('focus')); }}>Link guest</button>
      <button onClick={() => { localStorage.setItem('episode-ladder-guest-id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'); window.dispatchEvent(new Event('focus')); }}>Change guest</button>
      <button onClick={() => { failing = true; refresh(); }}>Fail requests</button>
    </nav>
    <PostComments postId="test-post" token={user} onLogin={() => {}} />
    {user && <GameComments accessToken={user} userId={user} universeId="got" gameId={1} mode="character" />}
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
