import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
window.__CHARACTERDLE_PUBLIC_CONFIG__ = { supabaseUrl: 'https://fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '' };
localStorage.setItem('episode-ladder-guest-id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
let generation = 1;
const originalNow = Date.now; let elapsed = 0;
Date.now = () => originalNow() + elapsed;
// Install the controlled clock before the cache resources capture Date.now.
const { useLeaderboard } = await import('../../src/hooks/useLeaderboard');
const { useEpisodeLadderLeaderboard } = await import('../../src/hooks/useEpisodeLadderLeaderboard');
window.fetch = async (_input, options) => {
  const headers = options?.headers as Record<string, string>;
  const identity = headers.Authorization ?? headers['X-Leaderboard-Guest-Id'];
  await new Promise(resolve => setTimeout(resolve, 20));
  return Response.json({ rows: [{ userId: `${identity}:${generation}` }], overview: {}, currentUser: null, streakRows: [] });
};
function Fixture() {
  const [account, setAccount] = useState<string | null>(null);
  const ordinary = useLeaderboard('got', account, account ?? 'guest');
  const ladder = useEpisodeLadderLeaderboard('got', account, account ?? 'guest', true);
  return <><output aria-label="Ordinary identity">{ordinary.data?.rows[0]?.userId ?? 'loading'}</output>
    <output aria-label="Ladder identity">{ladder.data?.rows[0]?.userId ?? 'loading'}</output>
    <button onClick={() => { localStorage.setItem('episode-ladder-guest-id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'); window.dispatchEvent(new Event('focus')); }}>Change guest</button>
    <button onClick={() => setAccount('account-a')}>Sign in A</button><button onClick={() => setAccount('account-b')}>Sign in B</button>
    <button onClick={() => setAccount(null)}>Sign out</button>
    <button onClick={() => { generation++; elapsed += 45001; window.dispatchEvent(new Event('focus')); }}>Expire and focus</button>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>);
