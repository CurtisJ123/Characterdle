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
  const displayName = user?.displayName ?? (isLoading ? 'Loading user...' : 'Guest');
  const supportingText = error ? error.message : user?.email ?? 'Not signed in';

  return (
    <article className="glass-card user-profile-card">
      <p className="card-kicker">{user ? 'Account' : 'Guest'}</p>
      <div className="profile-card-main">
        <span className="profile-avatar" aria-hidden="true">{getInitials(user?.displayName)}</span>
        <div>
          <h2>{displayName}</h2>
          <p>{supportingText}</p>
        </div>
      </div>
    </article>
  );
}
