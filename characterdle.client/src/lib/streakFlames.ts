import streakFlame00 from '../assets/streak-flames/flow/streak-flame-000.svg';
import streakFlame01 from '../assets/streak-flames/flow/streak-flame-001.svg';
import streakFlame02 from '../assets/streak-flames/flow/streak-flame-002.svg';
import streakFlame04 from '../assets/streak-flames/flow/streak-flame-004.svg';
import streakFlame07 from '../assets/streak-flames/flow/streak-flame-007.svg';
import streakFlame10 from '../assets/streak-flames/flow/streak-flame-010.svg';
import streakFlame14 from '../assets/streak-flames/flow/streak-flame-014.svg';
import streakFlame21 from '../assets/streak-flames/flow/streak-flame-021.svg';
import streakFlame30 from '../assets/streak-flames/flow/streak-flame-030.svg';
import streakFlame45 from '../assets/streak-flames/flow/streak-flame-045.svg';
import streakFlame60 from '../assets/streak-flames/flow/streak-flame-060.svg';
import streakFlame75 from '../assets/streak-flames/flow/streak-flame-075.svg';
import streakFlame100 from '../assets/streak-flames/flow/streak-flame-100.svg';
import streakFlame150 from '../assets/streak-flames/flow/streak-flame-150.svg';
import streakFlame200 from '../assets/streak-flames/flow/streak-flame-200.svg';
import streakFlame250 from '../assets/streak-flames/flow/streak-flame-250.svg';
import streakFlame300 from '../assets/streak-flames/flow/streak-flame-300.svg';
import streakFlame365 from '../assets/streak-flames/flow/streak-flame-365.svg';

export interface StreakFlameVariant {
  assetUrl: string;
  key: 'dormant' | 'starter' | 'building' | 'kindle' | 'weekly' | 'blaze' | 'forged' | 'whitehot'
    | 'masterwork' | 'azure' | 'glacier' | 'wildfire' | 'centurion' | 'nova'
    | 'crimson' | 'solar' | 'radiant' | 'mythic';
  threshold: number;
}

export interface StreakTierProgress {
  currentTier: StreakFlameVariant;
  currentTierUnlocked: boolean;
  daysRemainingToNext: number;
  nextTier: StreakFlameVariant | null;
  progressCurrentValue: number;
  progressMaxValue: number;
  progressRatio: number;
}

export const EMPTY_STREAK_FLAME: StreakFlameVariant = {
  assetUrl: streakFlame00,
  key: 'dormant',
  threshold: 0,
};

export const STREAK_FLAME_VARIANTS: readonly StreakFlameVariant[] = [
  { assetUrl: streakFlame01, key: 'starter', threshold: 1 },
  { assetUrl: streakFlame02, key: 'building', threshold: 2 },
  { assetUrl: streakFlame04, key: 'kindle', threshold: 4 },
  { assetUrl: streakFlame07, key: 'weekly', threshold: 7 },
  { assetUrl: streakFlame10, key: 'blaze', threshold: 10 },
  { assetUrl: streakFlame14, key: 'forged', threshold: 14 },
  { assetUrl: streakFlame21, key: 'whitehot', threshold: 21 },
  { assetUrl: streakFlame30, key: 'masterwork', threshold: 30 },
  { assetUrl: streakFlame45, key: 'azure', threshold: 45 },
  { assetUrl: streakFlame60, key: 'glacier', threshold: 60 },
  { assetUrl: streakFlame75, key: 'wildfire', threshold: 75 },
  { assetUrl: streakFlame100, key: 'centurion', threshold: 100 },
  { assetUrl: streakFlame150, key: 'nova', threshold: 150 },
  { assetUrl: streakFlame200, key: 'crimson', threshold: 200 },
  { assetUrl: streakFlame250, key: 'solar', threshold: 250 },
  { assetUrl: streakFlame300, key: 'radiant', threshold: 300 },
  { assetUrl: streakFlame365, key: 'mythic', threshold: 365 },
];

export function getStreakFlameVariant(streak: number): StreakFlameVariant {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const unlockedTier = [...STREAK_FLAME_VARIANTS]
    .reverse()
    .find((variant) => normalizedStreak >= variant.threshold);

  return unlockedTier ?? EMPTY_STREAK_FLAME;
}

export function getStreakTierProgress(streak: number): StreakTierProgress {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const unlockedTierIndex = STREAK_FLAME_VARIANTS.findLastIndex((variant) => normalizedStreak >= variant.threshold);
  const currentTier = unlockedTierIndex >= 0
    ? STREAK_FLAME_VARIANTS[unlockedTierIndex]
    : EMPTY_STREAK_FLAME;
  const nextTier = unlockedTierIndex >= 0
    ? STREAK_FLAME_VARIANTS[unlockedTierIndex + 1] ?? null
    : STREAK_FLAME_VARIANTS[0];

  if (!nextTier) {
    return {
      currentTier,
      currentTierUnlocked: normalizedStreak >= currentTier.threshold,
      daysRemainingToNext: 0,
      nextTier: null,
      progressCurrentValue: currentTier.threshold,
      progressMaxValue: currentTier.threshold,
      progressRatio: 1,
    };
  }

  const progressMaxValue = nextTier.threshold;
  const progressCurrentValue = Math.min(normalizedStreak, progressMaxValue);

  return {
    currentTier,
    currentTierUnlocked: unlockedTierIndex >= 0,
    daysRemainingToNext: Math.max(nextTier.threshold - normalizedStreak, 0),
    nextTier,
    progressCurrentValue,
    progressMaxValue,
    progressRatio: progressCurrentValue / progressMaxValue,
  };
}

export function formatStreakDayLabel(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}
