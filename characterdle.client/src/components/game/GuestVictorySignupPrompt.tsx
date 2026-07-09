import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MIN_PASSWORD_LENGTH, meetsMinimumPasswordLength } from '../../lib/authValidation';
import { GoogleAuthButton } from '../auth/GoogleAuthButton';
import { PasswordVisibilityButton } from '../auth/PasswordVisibilityButton';

export function GuestVictorySignupPrompt() {
  const { signInWithOAuth, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  const doPasswordsMatch = password === confirmPassword;
  const hasValidPasswordLength = meetsMinimumPasswordLength(password);
  const showPasswordTooShort = password.length > 0 && !hasValidPasswordLength;
  const showPasswordMismatch = confirmPassword.length > 0 && !doPasswordsMatch;
  const isSubmitDisabled = isBusy
    || !displayName.trim()
    || !email.trim()
    || !password.trim()
    || !hasValidPasswordLength
    || !confirmPassword
    || !doPasswordsMatch;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

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
            required
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
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          <span className="auth-field-label-row">
            <span>Password</span>
            <span
              className={`password-requirement${showPasswordTooShort ? ' is-error' : ''}`}
              id="guest-password-requirement"
            >
              Use at least {MIN_PASSWORD_LENGTH} characters.
            </span>
          </span>
          <span className="password-input-wrap">
            <input
              aria-describedby="guest-password-requirement"
              aria-invalid={showPasswordTooShort}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              name="password"
              placeholder="Create a password"
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
              aria-describedby={showPasswordMismatch ? 'guest-confirm-password-error' : undefined}
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
            <span className="password-match-error" id="guest-confirm-password-error" role="alert">
              Passwords do not match.
            </span>
          )}
        </label>

        {message && <p className="auth-feedback is-success">{message}</p>}
        {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

        <button className="primary-button large-button" disabled={isSubmitDisabled} type="submit">
          {isBusy ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <div className="guest-victory-signup-social" aria-label="Continue with Google">
        <div className="auth-form-divider" aria-hidden="true">
          <span>or</span>
        </div>
        <GoogleAuthButton disabled={isBusy} onClick={handleGoogleAuth} />
      </div>
    </section>
  );
}
