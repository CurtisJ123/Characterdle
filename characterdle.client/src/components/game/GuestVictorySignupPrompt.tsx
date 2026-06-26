import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function GuestVictorySignupPrompt() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  const isSubmitDisabled = isBusy || !displayName.trim() || !email.trim() || !password.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(undefined);
    setMessage(undefined);
    setIsBusy(true);

    try {
      const result = await signUp({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });

      setMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create your account right now.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="guest-victory-signup glass-card" aria-label="Sign up to save your win">
      <div className="guest-victory-signup-copy">
        <p className="card-kicker">Save This Win</p>
        <h3>Congratulations on winning</h3>
        <p className="muted-copy">
          Sign up now to be added to the leaderboard and keep track of your stats.
        </p>
      </div>

      <form className="auth-form guest-victory-signup-form" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            autoComplete="nickname"
            name="displayName"
            placeholder="CurtisJ"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

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
            autoComplete="new-password"
            name="password"
            placeholder="Create a password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {message && <p className="auth-feedback is-success">{message}</p>}
        {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

        <button className="primary-button large-button" disabled={isSubmitDisabled} type="submit">
          {isBusy ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <div className="guest-victory-signup-social" aria-label="More sign-up options coming soon">
        <p className="guest-victory-signup-social-copy">Apple and Google sign up coming soon.</p>
        <div className="guest-victory-signup-social-actions">
          <button className="secondary-button" type="button" disabled aria-disabled="true">
            Continue with Apple
          </button>
          <button className="secondary-button" type="button" disabled aria-disabled="true">
            Continue with Google
          </button>
        </div>
      </div>
    </section>
  );
}
