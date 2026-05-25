import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthFormValues } from '../../types/auth';
import type { AuthMode } from '../../types/routes';

interface AuthFormProps {
  errorMessage?: string;
  isBusy: boolean;
  message?: string;
  mode: AuthMode;
  onContinueAsGuest: () => void;
  onSubmit: (values: AuthFormValues) => Promise<void> | void;
}

export function AuthForm({
  errorMessage,
  isBusy,
  message,
  mode,
  onContinueAsGuest,
  onSubmit,
}: AuthFormProps) {
  const isSignup = mode === 'signup';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submitLabel = isSignup ? 'Create account' : 'Log in';
  const isSubmitDisabled = isBusy || !email.trim() || !password.trim() || (isSignup && !displayName.trim());

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        Password
        <input
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          name="password"
          placeholder="Enter your password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {message && <p className="auth-feedback is-success">{message}</p>}
      {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

      <button className="primary-button large-button" disabled={isSubmitDisabled} type="submit">
        {isBusy ? 'Working...' : submitLabel}
      </button>

      <button className="secondary-button large-button" disabled={isBusy} type="button" onClick={onContinueAsGuest}>
        Continue as guest
      </button>
    </form>
  );
}
