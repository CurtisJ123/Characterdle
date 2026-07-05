interface UserAvatarProps {
  avatarUrl?: string | null;
  className?: string;
  displayName?: string;
  isPremium?: boolean;
  size?: 'header' | 'card' | 'hero' | 'leaderboard';
}

function getInitials(displayName: string | undefined) {
  if (!displayName) {
    return '??';
  }

  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '??';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

export function UserAvatar({
  avatarUrl = null,
  className,
  displayName,
  isPremium = false,
  size = 'leaderboard',
}: UserAvatarProps) {
  const classes = className
    ? `user-avatar user-avatar--${size}${isPremium ? ' is-premium' : ''} ${className}`
    : `user-avatar user-avatar--${size}${isPremium ? ' is-premium' : ''}`;

  if (avatarUrl) {
    return (
      <span className={classes} aria-hidden="true">
        <span className="user-avatar__inner">
          <img src={avatarUrl} alt="" loading="lazy" />
        </span>
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      <span className="user-avatar__inner">
        <span className="user-avatar__initials">{getInitials(displayName)}</span>
      </span>
    </span>
  );
}
