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
      <h2>Welcome {user.displayName}</h2>

      <div className="button-stack">
        <button className="primary-button large-button" type="button" onClick={onContinue}>
          Continue
        </button>
        <button className="secondary-button large-button" disabled={isBusy} type="button" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </div>
  );
}
