import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, meetsMinimumPasswordLength } from '../../lib/authValidation';
import { PasswordVisibilityButton } from './PasswordVisibilityButton';

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const passwordsMatch = password === confirmPassword;
  const hasValidPasswordLength = meetsMinimumPasswordLength(password);
  const showPasswordTooShort = password.length > 0 && !hasValidPasswordLength;
  const canSubmit = isReady
    && hasValidPasswordLength
    && confirmPassword.length > 0
    && passwordsMatch;

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
        <span className="auth-field-label-row">
          <span>New password</span>
          <span
            className={`password-requirement${showPasswordTooShort ? ' is-error' : ''}`}
            id="reset-password-requirement"
          >
            Use at least {MIN_PASSWORD_LENGTH} characters.
          </span>
        </span>
        <span className="password-input-wrap">
          <input
            aria-describedby="reset-password-requirement"
            aria-invalid={showPasswordTooShort}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="newPassword"
            placeholder="Enter your new password"
            required
            type={isPasswordVisible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordVisibilityButton
            isVisible={isPasswordVisible}
            onToggle={() => setIsPasswordVisible((isVisible) => !isVisible)}
          />
        </span>
      </label>

      <label>
        Confirm password
        <span className="password-input-wrap">
          <input
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="confirmPassword"
            placeholder="Confirm your new password"
            required
            type={isConfirmPasswordVisible ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <PasswordVisibilityButton
            isVisible={isConfirmPasswordVisible}
            onToggle={() => setIsConfirmPasswordVisible((isVisible) => !isVisible)}
          />
        </span>
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
