# Streak Flame Artwork

`flow/` contains the active 17-tier lineup. Unlock thresholds are defined in `src/lib/streakFlames.ts`:

1, 2, 4, 7, 10, 14, 21, 30, 45, 60, 75, 100, 150, 200, 250, 300, and 365 days.

`flow/streak-flame-000.svg` is a separate neutral, unlit flame for zero-day streaks. It is not an unlock tier; day one remains the first reward.

The 100, 150, 200, 250, and 300-day flames use rainbow gradients. The 365-day flame is the white-and-gold one-year reward. Each Flow SVG uses a 96 by 112 viewBox and should be displayed with `object-fit: contain` without additional tier scaling.

The seven SVGs directly in this directory are the original artwork, intentionally preserved unchanged for future reuse. They are no longer imported by the active lineup. The previous thresholds were 1, 2, 7, 14, 30, 100, and 365 days.
