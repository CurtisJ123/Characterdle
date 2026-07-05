import streakFlame01 from '../assets/streak-flames/streak-flame-01.svg';
import streakFlame02 from '../assets/streak-flames/streak-flame-02.svg';
import streakFlame07 from '../assets/streak-flames/streak-flame-07.svg';
import streakFlame14 from '../assets/streak-flames/streak-flame-14.svg';
import streakFlame30 from '../assets/streak-flames/streak-flame-30.svg';
import streakFlame100 from '../assets/streak-flames/streak-flame-100.svg';
import streakFlame365 from '../assets/streak-flames/streak-flame-365.svg';

export interface StreakFlameVariant {
  assetUrl: string;
  key: 'starter' | 'building' | 'weekly' | 'forged' | 'masterwork' | 'centurion' | 'mythic';
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

export const STREAK_FLAME_VARIANTS: readonly StreakFlameVariant[] = [
  { assetUrl: streakFlame01, key: 'starter', threshold: 1 },
  { assetUrl: streakFlame02, key: 'building', threshold: 2 },
  { assetUrl: streakFlame07, key: 'weekly', threshold: 7 },
  { assetUrl: streakFlame14, key: 'forged', threshold: 14 },
  { assetUrl: streakFlame30, key: 'masterwork', threshold: 30 },
  { assetUrl: streakFlame100, key: 'centurion', threshold: 100 },
  { assetUrl: streakFlame365, key: 'mythic', threshold: 365 },
];

export function getStreakFlameVariant(streak: number): StreakFlameVariant {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const unlockedTier = [...STREAK_FLAME_VARIANTS]
    .reverse()
    .find((variant) => normalizedStreak >= variant.threshold);

  return unlockedTier ?? STREAK_FLAME_VARIANTS[0];
}

export function getStreakTierProgress(streak: number): StreakTierProgress {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const unlockedTierIndex = STREAK_FLAME_VARIANTS.findLastIndex((variant) => normalizedStreak >= variant.threshold);
  const currentTier = unlockedTierIndex >= 0
    ? STREAK_FLAME_VARIANTS[unlockedTierIndex]
    : STREAK_FLAME_VARIANTS[0];
  const nextTier = unlockedTierIndex >= 0
    ? STREAK_FLAME_VARIANTS[unlockedTierIndex + 1] ?? null
    : STREAK_FLAME_VARIANTS[1] ?? null;

  if (!nextTier) {
    return {
      currentTier,
      currentTierUnlocked: normalizedStreak >= currentTier.threshold,
      daysRemainingToNext: 0,
      nextTier: null,
      progressCurrentValue: 1,
      progressMaxValue: 1,
      progressRatio: 1,
    };
  }

  const progressStart = unlockedTierIndex >= 0
    ? currentTier.threshold
    : 0;
  const progressSpan = Math.max(nextTier.threshold - progressStart, 1);
  const progressCurrentValue = Math.min(Math.max(normalizedStreak - progressStart, 0), progressSpan);

  return {
    currentTier,
    currentTierUnlocked: normalizedStreak >= currentTier.threshold,
    daysRemainingToNext: Math.max(nextTier.threshold - normalizedStreak, 0),
    nextTier,
    progressCurrentValue,
    progressMaxValue: progressSpan,
    progressRatio: Math.min(Math.max(progressCurrentValue / progressSpan, 0), 1),
  };
}

export function formatStreakDayLabel(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}
