import type { UserProfile } from '../../types/user';

interface AuthenticatedPanelProps {
  isBusy: boolean;
  onContinue: () => void;
  onSignOut: () => Promise<void> | void;
  user: UserProfile;
}

export function AuthenticatedPanel({ isBusy, onContinue, onSignOut, user }: AuthenticatedPanelProps) {
  return (
    <div className="auth-account-panel">
      <div className="auth-card-heading">
        <span className="pill">Signed in</span>
        <h2>Welcome, {user.displayName}.</h2>
        <p>
          Your account is connected through Supabase Auth.
          Missing fields intentionally show as ERROR so we can wire the rest later.
        </p>
      </div>

      <div className="account-summary glass-card">
        <div className="account-summary-row">
          <span>Display name</span>
          <strong>{user.displayName}</strong>
        </div>
        <div className="account-summary-row">
          <span>Email</span>
          <strong>{user.email}</strong>
        </div>
        <div className="account-summary-row">
          <span>User id</span>
          <strong>{user.id}</strong>
        </div>
      </div>

      <div className="button-stack">
        <button className="primary-button large-button" type="button" onClick={onContinue}>
          Continue to launcher
        </button>
        <button className="secondary-button large-button" disabled={isBusy} type="button" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </div>
  );
}
