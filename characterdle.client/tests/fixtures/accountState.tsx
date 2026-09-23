// Local browser regression fixture. All API traffic is mocked by the test runner.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import '../../src/index.css';

if (!import.meta.env.DEV) throw new Error('This fixture is local-only.');
window.__CHARACTERDLE_PUBLIC_CONFIG__ = {
  supabaseUrl: 'https://account-fixture.invalid', supabasePublishableKey: 'fixture', apiBaseUrl: '',
};
const { supabase } = await import('../../src/lib/supabase');
const makeSession = (name: string): Session => ({
  access_token: `fixture-${name}`, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
  user: { id: name, aud: 'authenticated', email: `${name}@example.test`, created_at: '2026-09-01T00:00:00Z',
    app_metadata: {}, user_metadata: { display_name: name, avatar_url: null } },
});
let session: Session | null = makeSession('Member');
let authChange: ((event: AuthChangeEvent, session: Session | null) => void | Promise<void>) | undefined;
supabase.auth.getSession = async () => ({ data: { session }, error: null });
supabase.auth.getUser = async () => session
  ? { data: { user: session.user }, error: null }
  : { data: { user: null }, error: new Error('Signed out') as never };
supabase.auth.onAuthStateChange = callback => {
  authChange = callback;
  return { data: { subscription: { id: 'fixture', callback, unsubscribe: () => { authChange = undefined; } } } };
};
supabase.auth.signOut = async () => {
  session = null;
  await authChange?.('SIGNED_OUT', null);
  return { error: null };
};
supabase.auth.updateUser = async attributes => {
  if (!session) throw new Error('Signed out');
  session = { ...session, user: { ...session.user,
    user_metadata: { ...session.user.user_metadata, ...attributes.data } } };
  await authChange?.('USER_UPDATED', session);
  return { data: { user: session.user }, error: null };
};
window.addEventListener('fixture-auth', async event => {
  const name = (event as CustomEvent<string | null>).detail;
  session = name ? makeSession(name) : null;
  await authChange?.(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
});
window.addEventListener('fixture-token', async () => {
  if (session) session = { ...session, access_token: `${session.access_token}-renewed` };
  await authChange?.('TOKEN_REFRESHED', session);
});
window.addEventListener('fixture-reload', async () => {
  const { premiumResource, profileResource } = await import('../../src/lib/accountData');
  const { getPremiumState } = await import('../../src/services/premiumApi');
  const { getProfile } = await import('../../src/services/profileApi');
  if (!session) return;
  void premiumResource.load(session.user.id, 'premium', signal => getPremiumState(session!.access_token, signal), true);
  void profileResource.load(session.user.id, 'got', signal => getProfile(session!.access_token, 'got', signal), true);
});
const { default: App } = await import('../../src/App');
const { AuthProvider } = await import('../../src/contexts/AuthContext');
const { UniverseProvider } = await import('../../src/contexts/UniverseContext');
createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthProvider><UniverseProvider><App /></UniverseProvider></AuthProvider></StrictMode>,
);
