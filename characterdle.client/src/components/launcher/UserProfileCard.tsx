import type { UserProfile } from '../../types/user';

interface UserProfileCardProps {
  error: Error | null;
  isLoading: boolean;
  user: UserProfile | null;
}

function getInitials(displayName: string | undefined) {
  if (!displayName) {
    return '??';
  }

  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function UserProfileCard({ error, isLoading, user }: UserProfileCardProps) {
  const displayName = user?.displayName ?? (isLoading ? 'Loading user...' : 'Guest mode');
  const supportingText = error
    ? error.message
    : user?.email ?? 'Sign in to save progress and attach future game data to a real account.';

  return (
    <article className="glass-card user-profile-card">
      <p className="card-kicker">{user ? 'Supabase account' : 'Guest session'}</p>
      <div className="profile-card-main">
        <span className="profile-avatar" aria-hidden="true">{getInitials(user?.displayName)}</span>
        <div>
          <h2>{displayName}</h2>
          <p>{supportingText}</p>
        </div>
      </div>
      <p className="muted-copy">
        {user
          ? 'This card is using live Supabase Auth user data. Missing fields intentionally show as ERROR.'
          : 'You can keep exploring as a guest, or sign in to replace this card with live account data.'}
      </p>
    </article>
  );
}
