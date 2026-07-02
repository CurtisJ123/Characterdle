import streakFlame01 from '../../assets/streak-flames/streak-flame-01.svg';
import streakFlame02 from '../../assets/streak-flames/streak-flame-02.svg';
import streakFlame07 from '../../assets/streak-flames/streak-flame-07.svg';
import streakFlame14 from '../../assets/streak-flames/streak-flame-14.svg';
import streakFlame30 from '../../assets/streak-flames/streak-flame-30.svg';
import streakFlame100 from '../../assets/streak-flames/streak-flame-100.svg';
import streakFlame365 from '../../assets/streak-flames/streak-flame-365.svg';

interface StreakEmblemProps {
  className?: string;
  showCount?: boolean;
  size?: 'compact' | 'regular';
  streak: number;
}

interface StreakFlameVariant {
  assetUrl: string;
  key: 'starter' | 'building' | 'weekly' | 'forged' | 'masterwork' | 'centurion' | 'mythic';
  threshold: number;
}

const STREAK_FLAME_VARIANTS: readonly StreakFlameVariant[] = [
  { assetUrl: streakFlame365, key: 'mythic', threshold: 365 },
  { assetUrl: streakFlame100, key: 'centurion', threshold: 100 },
  { assetUrl: streakFlame30, key: 'masterwork', threshold: 30 },
  { assetUrl: streakFlame14, key: 'forged', threshold: 14 },
  { assetUrl: streakFlame07, key: 'weekly', threshold: 7 },
  { assetUrl: streakFlame02, key: 'building', threshold: 2 },
  { assetUrl: streakFlame01, key: 'starter', threshold: 1 },
];

function getStreakFlameVariant(streak: number): StreakFlameVariant {
  return STREAK_FLAME_VARIANTS.find((variant) => streak >= variant.threshold)
    ?? STREAK_FLAME_VARIANTS[STREAK_FLAME_VARIANTS.length - 1];
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
