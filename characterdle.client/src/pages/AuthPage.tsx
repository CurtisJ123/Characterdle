import { useState } from 'react';
import { AuthForm } from '../components/auth/AuthForm';
import { AuthModeToggle } from '../components/auth/AuthModeToggle';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface AuthPageProps {
  initialMode: AuthMode;
  onNavigate: NavigateToPage;
}

export function AuthPage({ initialMode, onNavigate }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const isSignup = mode === 'signup';

  return (
    <main className="page auth-page">
      <section className="auth-copy">
        <p className="eyebrow">Join the daily realm</p>
        <h1>{isSignup ? 'Create your raven account.' : 'Welcome back, maester.'}</h1>
        <p>
          Save your streak, compare leaderboard runs, and keep your ASOIAF
          deductions synced once Supabase auth is connected.
        </p>
      </section>

      <section className="auth-card glass-card" aria-label={isSignup ? 'Sign up form' : 'Login form'}>
        <AuthModeToggle mode={mode} onChange={setMode} />
        <div className="auth-card-heading">
          <span className="pill">{isSignup ? 'New account' : 'Returning player'}</span>
          <h2>{isSignup ? 'Start tracking your streak.' : 'Continue your run.'}</h2>
          <p>{isSignup ? 'No payment required. Just lore, stubbornness, and a password.' : 'Log in to resume your saved stats and daily progress.'}</p>
        </div>
        <AuthForm mode={mode} onContinueAsGuest={() => onNavigate('launcher')} />
      </section>
    </main>
  );
}
