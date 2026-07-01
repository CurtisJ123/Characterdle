interface StreakEmblemProps {
  className?: string;
  showCount?: boolean;
  size?: 'compact' | 'regular';
  streak: number;
}

type StreakIntensityTier = 'ember' | 'kindled' | 'rising' | 'blazing' | 'legendary';

function getStreakIntensityTier(streak: number): StreakIntensityTier {
  if (streak >= 30) {
    return 'legendary';
  }

  if (streak >= 14) {
    return 'blazing';
  }

  if (streak >= 7) {
    return 'rising';
  }

  if (streak >= 3) {
    return 'kindled';
  }

  return 'ember';
}

export function StreakEmblem({
  className,
  showCount = true,
  size = 'compact',
  streak,
}: StreakEmblemProps) {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const classes = className
    ? `streak-emblem streak-emblem--${size} ${className}`
    : `streak-emblem streak-emblem--${size}`;

  return (
    <span
      className={classes}
      data-intensity={getStreakIntensityTier(normalizedStreak)}
      aria-hidden="true"
    >
      <span className="streak-emblem__mark">
        <span className="streak-emblem__glow" />
        <span className="streak-emblem__flame">
          <span className="streak-emblem__flame-outer" />
          <span className="streak-emblem__flame-inner" />
        </span>
      </span>
      {showCount && <span className="streak-emblem__count">{normalizedStreak}</span>}
    </span>
  );
}
