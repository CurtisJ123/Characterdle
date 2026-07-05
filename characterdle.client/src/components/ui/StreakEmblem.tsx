import { getStreakFlameVariant } from '../../lib/streakFlames';

interface StreakEmblemProps {
  className?: string;
  showCount?: boolean;
  size?: 'compact' | 'regular';
  streak: number;
}

export function StreakEmblem({
  className,
  showCount = true,
  size = 'compact',
  streak,
}: StreakEmblemProps) {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const variant = getStreakFlameVariant(normalizedStreak);
  const classes = className
    ? `streak-emblem streak-emblem--${size} ${className}`
    : `streak-emblem streak-emblem--${size}`;

  return (
    <span
      className={classes}
      data-empty={normalizedStreak === 0 ? 'true' : 'false'}
      data-variant={variant.key}
      aria-hidden="true"
    >
      <span className="streak-emblem__mark">
        <img className="streak-emblem__flame-image" src={variant.assetUrl} alt="" />
        {showCount && <span className="streak-emblem__count">{normalizedStreak}</span>}
      </span>
    </span>
  );
}
