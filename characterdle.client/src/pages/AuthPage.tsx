import { useEffect, useState } from 'react';
import { AuthenticatedPanel } from '../components/auth/AuthenticatedPanel';
import { AuthForm } from '../components/auth/AuthForm';
import { EmailSentPanel } from '../components/auth/EmailSentPanel';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm';
import { useAuth } from '../contexts/AuthContext';
import type { AuthFormValues } from '../types/auth';
import { AuthModeToggle } from '../components/auth/AuthModeToggle';
import { consumePendingOAuthRedirect } from '../lib/oauthState';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface AuthPageProps {
  initialMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

interface PendingEmailAction {
  email: string;
  kind: 'confirmation' | 'passwordReset';
  sentAt: number | null;
}

function isEmailNotConfirmedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const authError = error as Error & { code?: string };
  return authError.code === 'email_not_confirmed'
    || error.message.toLowerCase().includes('email not confirmed');
}

export function AuthPage({ initialMode, onAuthModeChange, onNavigate }: AuthPageProps) {
  const {
    completePasswordReset,
    isAuthenticated,
    isPasswordRecovery,
    requestPasswordReset,
    resendConfirmationEmail,
    signIn,
    signInWithOAuth,
    signOut,
    signUp,
    user,
  } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [mode, setMode] = useState<AuthMode>(isPasswordRecovery ? 'resetPassword' : initialMode);
  const [pendingEmailAction, setPendingEmailAction] = useState<PendingEmailAction | null>(null);
  const isPrimaryMode = mode === 'login' || mode === 'signup';
  const primaryMode = mode === 'signup' ? 'signup' : 'login';
  const heroTitle = isAuthenticated && mode !== 'resetPassword'
    ? 'Welcome back'
    : pendingEmailAction
      ? 'Check your email'
    : mode === 'signup'
      ? 'Create account'
      : mode === 'forgotPassword'
        ? 'Reset password'
        : mode === 'resetPassword'
        ? 'Choose a new password'
          : 'Welcome back';

  useEffect(() => {
    setMode(initialMode);
    setPendingEmailAction(null);
  }, [initialMode]);

  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('resetPassword');
      if (initialMode !== 'resetPassword') {
        onAuthModeChange('resetPassword');
      }
    }
  }, [initialMode, isPasswordRecovery, onAuthModeChange]);

  useEffect(() => {
    if (!isAuthenticated || mode === 'resetPassword') {
      return;
    }

    if (consumePendingOAuthRedirect('google')) {
      onNavigate('launcher');
    }
  }, [isAuthenticated, mode, onNavigate]);

  function handleModeChange(nextMode: AuthMode) {
    setErrorMessage(undefined);
    setMessage(undefined);
    setPendingEmailAction(null);
    setMode(nextMode);
    onAuthModeChange(nextMode);
  }

  async function handleSubmit(values: AuthFormValues) {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      const result = primaryMode === 'signup' ? await signUp(values) : await signIn(values);

      setMessage(result.message);

      if (result.requiresEmailConfirmation) {
        setPendingEmailAction({
          email: values.email.trim(),
          kind: 'confirmation',
          sentAt: Date.now(),
        });
        return;
      }

      onNavigate('launcher');
    } catch (error) {
      if (primaryMode === 'login' && isEmailNotConfirmedError(error)) {
        setMessage('Confirm your email before logging in.');
        setPendingEmailAction({
          email: values.email.trim(),
          kind: 'confirmation',
          sentAt: null,
        });
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Unable to authenticate right now.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleForgotPassword(email: string) {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      const result = await requestPasswordReset({ email });
      setMessage(result.message);
      setPendingEmailAction({
        email: email.trim(),
        kind: 'passwordReset',
        sentAt: Date.now(),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send a password reset email.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResetPassword(password: string) {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      await completePasswordReset({ password });
      onNavigate('launcher');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your password.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResendEmail() {
    if (!pendingEmailAction) {
      return;
    }

    setErrorMessage(undefined);
    setIsBusy(true);

    try {
      const result = pendingEmailAction.kind === 'confirmation'
        ? await resendConfirmationEmail({ email: pendingEmailAction.email })
        : await requestPasswordReset({ email: pendingEmailAction.email });

      setMessage(result.message);
      setPendingEmailAction({
        ...pendingEmailAction,
        sentAt: Date.now(),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to resend the email.');
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

  async function handleGoogleAuth() {
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      await signInWithOAuth('google');
      setIsBusy(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to continue with Google right now.');
      setIsBusy(false);
    }
  }

  async function handleReturnToLogin() {
    if (isAuthenticated && mode === 'resetPassword') {
      try {
        await signOut();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to log out right now.');
        return;
      }
    }

    setErrorMessage(undefined);
    setMessage(undefined);
    handleModeChange('login');
  }

  return (
    <main className="page auth-page">
      <section className="auth-copy">
        <h1>{heroTitle}</h1>
      </section>

      <section
        className="auth-card glass-card"
        aria-label={isAuthenticated && mode !== 'resetPassword'
          ? 'Account actions'
          : pendingEmailAction
            ? 'Email sent'
          : mode === 'signup'
            ? 'Sign up form'
            : mode === 'forgotPassword'
              ? 'Forgot password form'
              : mode === 'resetPassword'
                ? 'Reset password form'
                : 'Login form'}
      >
        {isAuthenticated && user && mode !== 'resetPassword' ? (
          <AuthenticatedPanel
            isBusy={isBusy}
            onContinue={() => onNavigate('launcher')}
            onSignOut={handleSignOut}
            user={user}
          />
        ) : pendingEmailAction ? (
          <>
            <div className="auth-card-heading">
              <h2>Check your email</h2>
            </div>
            <EmailSentPanel
              email={pendingEmailAction.email}
              errorMessage={errorMessage}
              isBusy={isBusy}
              message={message ?? 'Check your email for the link.'}
              onBackToLogin={handleReturnToLogin}
              onResend={handleResendEmail}
              sentAt={pendingEmailAction.sentAt}
            />
          </>
        ) : isPrimaryMode ? (
          <>
            <AuthModeToggle mode={primaryMode} onChange={handleModeChange} />
            <div className="auth-card-heading">
              <h2>{primaryMode === 'signup' ? 'Create account' : 'Log in'}</h2>
            </div>
            <AuthForm
              errorMessage={errorMessage}
              isBusy={isBusy}
              message={message}
              mode={primaryMode}
              onContinueAsGuest={() => onNavigate('launcher')}
              onContinueWithGoogle={handleGoogleAuth}
              onForgotPassword={() => handleModeChange('forgotPassword')}
              onSubmit={handleSubmit}
            />
          </>
        ) : mode === 'forgotPassword' ? (
          <>
            <div className="auth-card-heading">
              <h2>Reset password</h2>
            </div>
            <ForgotPasswordForm
              errorMessage={errorMessage}
              isBusy={isBusy}
              message={message}
              onBackToLogin={handleReturnToLogin}
              onSubmit={handleForgotPassword}
            />
          </>
        ) : (
          <>
            <div className="auth-card-heading">
              <h2>Choose a new password</h2>
            </div>
            <ResetPasswordForm
              errorMessage={errorMessage}
              isBusy={isBusy}
              isReady={isPasswordRecovery || isAuthenticated}
              message={message}
              onBackToLogin={handleReturnToLogin}
              onRequestNewLink={() => handleModeChange('forgotPassword')}
              onSubmit={handleResetPassword}
            />
          </>
        )}
      </section>
    </main>
  );
}
