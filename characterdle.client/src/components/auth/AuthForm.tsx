import type { AuthMode } from '../../types/routes';

interface AuthFormProps {
  mode: AuthMode;
  onContinueAsGuest: () => void;
}

export function AuthForm({ mode, onContinueAsGuest }: AuthFormProps) {
  const isSignup = mode === 'signup';
  const submitLabel = isSignup ? 'Create account' : 'Log in';

  return (
    <form className="auth-form" onSubmit={(event) => event.preventDefault()}>
      {isSignup && (
        <label>
          Display name
          <input autoComplete="nickname" name="displayName" placeholder="CrowCaller" type="text" />
        </label>
      )}

      <label>
        Email
        <input autoComplete="email" name="email" placeholder="you@ravens.net" type="email" />
      </label>

      <label>
        Password
        <input
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          name="password"
          placeholder="Enter your password"
          type="password"
        />
      </label>

      {!isSignup && (
        <div className="auth-row">
          <label className="auth-check">
            <input name="remember" type="checkbox" />
            Remember me
          </label>
          <button className="text-button" type="button">Forgot password?</button>
        </div>
      )}

      <button className="primary-button large-button" type="submit">
        {submitLabel}
      </button>

      <button className="secondary-button large-button" type="button" onClick={onContinueAsGuest}>
        Continue as guest
      </button>
    </form>
  );
}
