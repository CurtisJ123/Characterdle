import { useState } from 'react';
import type { FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, meetsMinimumPasswordLength } from '../../lib/authValidation';
import type { AuthFormValues } from '../../types/auth';
import type { PrimaryAuthMode } from '../../types/routes';
import { PasswordVisibilityButton } from './PasswordVisibilityButton';

interface AuthFormProps {
  errorMessage?: string;
  isBusy: boolean;
  message?: string;
  mode: PrimaryAuthMode;
  onContinueAsGuest: () => void;
  onForgotPassword?: () => void;
  onSubmit: (values: AuthFormValues) => Promise<void> | void;
}

export function AuthForm({
  errorMessage,
  isBusy,
  message,
  mode,
  onContinueAsGuest,
  onForgotPassword,
  onSubmit,
}: AuthFormProps) {
  const isSignup = mode === 'signup';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const submitLabel = isSignup ? 'Create account' : 'Log in';
  const doPasswordsMatch = password === confirmPassword;
  const hasValidPasswordLength = !isSignup || meetsMinimumPasswordLength(password);
  const showPasswordTooShort = isSignup && password.length > 0 && !hasValidPasswordLength;
  const showPasswordMismatch = isSignup && confirmPassword.length > 0 && !doPasswordsMatch;
  const isSubmitDisabled = isBusy
    || !email.trim()
    || !password.trim()
    || (isSignup && (!displayName.trim() || !confirmPassword || !doPasswordsMatch || !hasValidPasswordLength));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    void onSubmit({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
    });
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isSignup && (
        <label>
          Display name
          <input
            autoComplete="nickname"
            name="displayName"
            placeholder="Example User"
            required
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
      )}

      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          placeholder="example@email.com"
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        <span className="auth-field-label-row">
          <span>Password</span>
          {isSignup && (
            <span
              className={`password-requirement${showPasswordTooShort ? ' is-error' : ''}`}
              id="password-requirement"
            >
              Use at least {MIN_PASSWORD_LENGTH} characters.
            </span>
          )}
        </span>
        <span className="password-input-wrap">
          <input
            aria-describedby={isSignup ? 'password-requirement' : undefined}
            aria-invalid={showPasswordTooShort}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
            name="password"
            placeholder="Enter your password"
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

      {isSignup && (
        <label>
          Confirm password
          <span className="password-input-wrap">
            <input
              aria-describedby={showPasswordMismatch ? 'confirm-password-error' : undefined}
              aria-invalid={showPasswordMismatch}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              name="confirmPassword"
              placeholder="Enter your password again"
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
          {showPasswordMismatch && (
            <span className="password-match-error" id="confirm-password-error" role="alert">
              Passwords do not match.
            </span>
          )}
        </label>
      )}

      {message && <p className="auth-feedback is-success">{message}</p>}
      {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

      <button className="primary-button large-button" disabled={isSubmitDisabled} type="submit">
        {isBusy ? 'Working...' : submitLabel}
      </button>

      {!isSignup && onForgotPassword && (
        <button className="auth-inline-button" disabled={isBusy} type="button" onClick={onForgotPassword}>
          Forgot password?
        </button>
      )}

      <button className="secondary-button large-button" disabled={isBusy} type="button" onClick={onContinueAsGuest}>
        Continue as guest
      </button>
    </form>
  );
}
