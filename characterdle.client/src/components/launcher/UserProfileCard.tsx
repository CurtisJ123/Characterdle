import type { UserProfile } from '../../types/user';
import { UserAvatar } from '../ui/UserAvatar';

interface UserProfileCardProps {
  error: Error | null;
  isLoading: boolean;
  user: UserProfile | null;
}

export function UserProfileCard({ error, isLoading, user }: UserProfileCardProps) {
  const displayName = user?.displayName ?? (isLoading ? 'Loading user...' : 'Guest');
  const supportingText = error ? error.message : user ? null : 'Not signed in';

  return (
    <article className="glass-card user-profile-card">
      <p className="card-kicker">{user ? 'Account' : 'Guest'}</p>
      <div className="profile-card-main">
        <UserAvatar avatarUrl={user?.avatarUrl} displayName={user?.displayName} size="card" className="profile-avatar" />
        <div>
          <h2>{displayName}</h2>
          {supportingText && <p>{supportingText}</p>}
        </div>
      </div>
    </article>
  );
}
