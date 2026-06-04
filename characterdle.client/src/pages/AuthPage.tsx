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
  const heroTitle = isAuthenticated || !isSignup ? 'Welcome back' : 'Create account';

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
        <h1>{heroTitle}</h1>
      </section>

      <section
        className="auth-card glass-card"
        aria-label={isAuthenticated ? 'Account actions' : isSignup ? 'Sign up form' : 'Login form'}
      >
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
              <h2>{isSignup ? 'Create account' : 'Log in'}</h2>
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
