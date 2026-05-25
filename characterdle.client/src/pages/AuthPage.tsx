import { useState } from 'react';
import { AuthenticatedPanel } from '../components/auth/AuthenticatedPanel';
import { AuthForm } from '../components/auth/AuthForm';
import { useAuth } from '../contexts/AuthContext';
import type { AuthFormValues } from '../types/auth';
import { AuthModeToggle } from '../components/auth/AuthModeToggle';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface AuthPageProps {
  initialMode: AuthMode;
  onNavigate: NavigateToPage;
}

export function AuthPage({ initialMode, onNavigate }: AuthPageProps) {
  const { isAuthenticated, signIn, signOut, signUp, user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const isSignup = mode === 'signup';

  async function handleSubmit(values: AuthFormValues) {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      const result = isSignup ? await signUp(values) : await signIn(values);

      setMessage(result.message);

      if (!result.requiresEmailConfirmation) {
        onNavigate('launcher');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to authenticate right now.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      await signOut();
      setMessage('You have been logged out.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to log out right now.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="auth-copy">
        <p className="eyebrow">Account access</p>
        <h1>{isSignup ? 'Create your account.' : 'Welcome back.'}</h1>
        <p>
          Save progress, keep your account synced, and use the same login every time.
        </p>
      </section>

      <section className="auth-card glass-card" aria-label={isSignup ? 'Sign up form' : 'Login form'}>
        {isAuthenticated && user ? (
          <AuthenticatedPanel
            isBusy={isBusy}
            onContinue={() => onNavigate('launcher')}
            onSignOut={handleSignOut}
            user={user}
          />
        ) : (
          <>
            <AuthModeToggle mode={mode} onChange={setMode} />
            <div className="auth-card-heading">
              <span className="pill">{isSignup ? 'New account' : 'Returning player'}</span>
              <h2>{isSignup ? 'Start tracking your streak.' : 'Continue your run.'}</h2>
              <p>{isSignup ? 'Create an account with your email and password.' : 'Log in to resume your saved progress.'}</p>
            </div>
            <AuthForm
              errorMessage={errorMessage}
              isBusy={isBusy}
              message={message}
              mode={mode}
              onContinueAsGuest={() => onNavigate('launcher')}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </section>
    </main>
  );
}
