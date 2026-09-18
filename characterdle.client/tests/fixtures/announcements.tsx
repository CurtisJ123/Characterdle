// Local-only UI fixture. All API requests are intercepted in memory; no auth or database is used.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminPage } from '../../src/pages/AdminPage';
import { UpdatesPage } from '../../src/pages/UpdatesPage';
import { AnnouncementPopup } from '../../src/components/updates/AnnouncementPopup';
import { LatestUpdatePopup } from '../../src/components/updates/LatestUpdatePopup';
import type { AdminComment } from '../../src/types/admin';
import { rememberAnnouncement } from '../../src/lib/announcementState';
import type { Announcement, AnnouncementComment } from '../../src/types/announcements';
import '../../src/index.css';
import '../../src/App.css';

window.__CHARACTERDLE_PUBLIC_CONFIG__ = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '' };
let posts: Announcement[] = [{ id: '00000000-0000-0000-0000-000000000001', title: 'A new way to explore Westeros', slug: 'new-mode',
  summary: 'New streak artwork and site updates, inspired by our players.',
  bodyMarkdown: '# Welcome to the Formatting Test\nThis is regular text with **bold text** and *italic text* mixed into one paragraph.\n\nYou can also combine them like ***bold and italic text***.\n\n## Features\n- First list item\n- Item with **bold text**\n- Item with *italic text*\n- A [test link](https://example.com)\n\n### Useful links\n[Play a round](/got)\n\n> A quoted note.\n\n1. First numbered item\n2. Second numbered item\n\n---\n\nUse `inline code` or a code block:\n\n```text\nExample code\n```\n\n#### Heading four\n##### Heading five\n###### Heading six\n\n<script>alert("unsafe")</script>\n\n[Unsafe link](javascript:alert(1))',
  status: 'published', showPopup: true, publishedAt: '2026-09-17T12:00:00Z', updatedAt: '2026-09-17T12:00:00Z' }];
let comments: AnnouncementComment[] = Array.from({ length: 7 }, (_, index) => ({ id: `comment-${index}`, announcementId: posts[0].id,
  postTitle: posts[0].title, postSlug: posts[0].slug, displayName: index ? `Player ${index}` : 'Westeros Wanderer', avatarUrl: null,
  showSupporterBadge: !index, body: index ? 'Looking forward to trying the new mode!' : 'The new daily challenge sounds great. Thanks for continuing to improve the game!',
  createdAt: `2026-09-17T13:0${index}:00Z`, isOwn: !index, isHidden: false }));
posts[0].bodyMarkdown += '\n\n## Markdown extensions\n\n~~Old wording~~ New wording\n\n- [x] Shipped\n- [ ] Coming next\n\n| Feature | Status | Notes |\n| :-- | :--: | --: |\n| Images | Ready | Responsive on mobile |\n| Tables | Ready | Scroll horizontally if needed |\n\nA footnote reference[^note].\n\n[^note]: A useful footnote.\n\n![Characterdle artwork](/android-chrome-512x512.png)\n\n![Unsafe image](javascript:alert(1))';
const gameComments: AdminComment[] = ['character', 'quote'].map((mode, index) => ({
  id: `game-${mode}`, source: 'game', contextTitle: `GOT / ${mode === 'quote' ? 'Quote' : 'Character'} #50`,
  contextUrl: `/got/game/${mode}/50`, displayName: 'Game player', avatarUrl: null,
  body: 'A comment on a completed game.', createdAt: `2026-09-17T13:0${5 + index}:30Z`, isHidden: false, canModerate: false,
}));
const claimed = new Set<string>();
let dashboardRequests = 0;
const activity = { uploads: 0, saves: 0, lastSavedBody: '' };
function recordActivity() { window.dispatchEvent(new Event('fixture-activity')); }
window.fetch = async (input, options) => {
  const url = new URL(String(input), window.location.origin), path = url.pathname, method = options?.method ?? 'GET';
  const body = typeof options?.body === 'string' ? JSON.parse(options.body) : null;
  const page = Number(url.searchParams.get('page') ?? 1);
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  if (path === '/api/admin/access') return json({ isAdmin: true });
  if (path === '/api/admin/updates/images' && method === 'POST') {
    activity.uploads++; recordActivity();
    const attempt = activity.uploads;
    await new Promise(resolve => setTimeout(resolve, 750));
    const scenario = new URLSearchParams(location.search).get('upload');
    if (scenario === 'error' || (scenario === 'fail-second-once' && attempt === 2)) return json({}, 503);
    if (!(options?.body instanceof File)) return json({}, 400);
    return json({ url: `/android-chrome-512x512.png?upload=${attempt}` }, 201);
  }
  if (path === '/api/admin/dashboard') {
    const scenario = new URLSearchParams(location.search).get('dashboard');
    if (scenario === 'error' && dashboardRequests++ < 2) return json({}, 503);
    if (scenario === 'loading') await new Promise(resolve => setTimeout(resolve, 3000));
    const value = (number: number) => scenario === 'empty' ? 0 : number;
    return json({ generatedAt: '2026-09-17T12:00:00Z', activitySince: '2026-09-10T12:00:00Z',
      profiles: value(135), newProfiles: value(125), accountsWithCompletedGames: value(113),
      premium: { users: value(9), trialUsers: value(6), activeSubscriptions: value(2), pastDueSubscriptions: value(1) },
      players: { uniquePlayers: value(12345), activePlayers: value(189), startedGames: value(34567), completedGames: value(23456) } });
  }
  if (path.endsWith('/claim')) { const id = path.split('/')[3], first = !claimed.has(id); claimed.add(id); return json({ claimed: first }); }
  if (path.endsWith('/seen')) return json({ claimed: true });
  if (path === '/api/updates/current') {
    const scenario = new URLSearchParams(location.search).get('latest');
    if (scenario === 'error') return json({}, 503);
    if (scenario === 'loading') await new Promise(resolve => setTimeout(resolve, 3000));
    return json({ post: scenario === 'empty' ? null : posts[0] });
  }
  if (path === '/api/admin/comments' && method === 'GET') {
    const source = url.searchParams.get('source') ?? 'all';
    const updates: AdminComment[] = comments.map(comment => ({ ...comment, source: 'update', contextTitle: comment.postTitle,
      contextUrl: `/updates/${comment.postSlug}`, canModerate: true }));
    const all = [...(source !== 'games' ? updates : []), ...(source !== 'updates' ? gameComments : [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ items: all.slice((page - 1) * 5, page * 5), page, hasNextPage: all.length > page * 5 });
  }
  if (path.includes('/comments')) {
    if (method === 'POST') { comments.push({ ...comments[0], id: 'new-comment', body: body.body }); return json(null, 201); }
    if (method === 'DELETE') { comments = comments.filter(comment => !path.endsWith(comment.id)); return new Response(null, { status: 204 }); }
    if (method === 'PUT') { comments = comments.map(comment => path.endsWith(comment.id) ? { ...comment, isHidden: body.hidden } : comment); return new Response(null, { status: 204 }); }
    const visible = path.startsWith('/api/admin') ? comments : comments.filter(comment => !comment.isHidden);
    return json({ items: visible.slice((page - 1) * 5, page * 5), page, hasNextPage: visible.length > page * 5 });
  }
  if (path.startsWith('/api/admin/updates') && method !== 'GET') {
    activity.saves++; recordActivity();
    if (body.bodyMarkdown.includes('announcement-image:')) return json({ detail: 'Unresolved local image.' }, 400);
    if (new URLSearchParams(location.search).get('save') === 'error-once' && activity.saves === 1) return json({}, 503);
    activity.lastSavedBody = body.bodyMarkdown; recordActivity();
    const post = { ...body, id: path.split('/')[4] ?? crypto.randomUUID(), publishedAt: body.status === 'published' ? new Date().toISOString() : null, updatedAt: new Date().toISOString() };
    posts = [post, ...posts.filter(item => item.id !== post.id)]; return json(post);
  }
  if (path.startsWith('/api/updates/by-slug/')) return json(posts[0]);
  if (path === '/api/updates' || path === '/api/admin/updates') return json({ items: posts, page, hasNextPage: false });
  throw new Error(`Unexpected fixture request: ${path}`);
};

export function Fixture() {
  const query = new URLSearchParams(location.search), mode = query.get('mode') ?? 'post';
  const [unread, setUnread] = useState(true);
  const [latestOpen, setLatestOpen] = useState(false);
  const [requests, setRequests] = useState({ ...activity });
  useEffect(() => {
    function update() { setRequests({ ...activity }); }
    window.addEventListener('fixture-activity', update);
    return () => window.removeEventListener('fixture-activity', update);
  }, []);
  return <div className="app-shell" style={{ padding: '20px', minHeight: '100vh' }}>
    {mode === 'admin' && <aside style={{ padding: '12px', color: '#f4ebd0', fontSize: '14px' }}>
      <output aria-label="Fixture request counts">Image upload requests: {requests.uploads}. Post save requests: {requests.saves}.</output>
      {requests.lastSavedBody && <details><summary>Fixture saved Markdown</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{requests.lastSavedBody}</pre></details>}
    </aside>}
    {mode === 'latest' ? <button className="secondary-button" onClick={() => setLatestOpen(true)}>Updates</button>
      : mode === 'admin' ? <AdminPage token="fixture" onLogin={() => {}} />
      : <UpdatesPage slug={mode === 'post' ? 'new-mode' : undefined} token="fixture" userId="fixture-user" onLogin={() => {}} />}
    {mode === 'popup' && <AnnouncementPopup post={{ ...posts[0], id: '00000000-0000-0000-0000-000000000002' }} unread={unread} token={null} onLogin={() => {}} onSeen={id => { rememberAnnouncement(id); setUnread(false); }} />}
    {latestOpen && <LatestUpdatePopup token={null} onSeen={() => {}} onClose={() => setLatestOpen(false)} onLogin={() => setLatestOpen(false)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
