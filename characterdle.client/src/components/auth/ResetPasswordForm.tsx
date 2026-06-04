import { useState, type FormEvent } from 'react';

interface ResetPasswordFormProps {
  errorMessage?: string;
  isBusy: boolean;
  isReady: boolean;
  message?: string;
  onBackToLogin: () => void;
  onRequestNewLink: () => void;
  onSubmit: (password: string) => Promise<void> | void;
}

export function ResetPasswordForm({
  errorMessage,
  isBusy,
  isReady,
  message,
  onBackToLogin,
  onRequestNewLink,
  onSubmit,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isReady && password.length > 0 && confirmPassword.length > 0 && passwordsMatch;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    void onSubmit(password);
  }

  return (
    <form className="reset-password-form auth-form" onSubmit={handleSubmit}>
      {!isReady && (
        <p className="auth-feedback is-error">
          This reset link is not active. Request a new password reset email to continue.
        </p>
      )}

      <label>
        New password
        <input
          autoComplete="new-password"
          name="newPassword"
          placeholder="Enter your new password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <label>
        Confirm password
        <input
          autoComplete="new-password"
          name="confirmPassword"
          placeholder="Confirm your new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>

      {!passwordsMatch && confirmPassword.length > 0 && (
        <p className="auth-feedback is-error">Passwords must match.</p>
      )}
      {message && <p className="auth-feedback is-success">{message}</p>}
      {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

      <button className="primary-button large-button" disabled={isBusy || !canSubmit} type="submit">
        {isBusy ? 'Saving...' : 'Update password'}
      </button>

      <button className="auth-inline-button" disabled={isBusy} type="button" onClick={isReady ? onBackToLogin : onRequestNewLink}>
        {isReady ? 'Back to log in' : 'Request a new link'}
      </button>
    </form>
  );
}
