import { useState, type FormEvent } from 'react';

interface ForgotPasswordFormProps {
  errorMessage?: string;
  isBusy: boolean;
  message?: string;
  onBackToLogin: () => void;
  onSubmit: (email: string) => Promise<void> | void;
}

export function ForgotPasswordForm({
  errorMessage,
  isBusy,
  message,
  onBackToLogin,
  onSubmit,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(email.trim());
  }

  return (
    <form className="forgot-password-form auth-form" onSubmit={handleSubmit}>
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

      {message && <p className="auth-feedback is-success">{message}</p>}
      {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

      <button className="primary-button large-button" disabled={isBusy || !email.trim()} type="submit">
        {isBusy ? 'Sending...' : 'Send reset link'}
      </button>

      <button className="auth-inline-button" disabled={isBusy} type="button" onClick={onBackToLogin}>
        Back to log in
      </button>
    </form>
  );
}
