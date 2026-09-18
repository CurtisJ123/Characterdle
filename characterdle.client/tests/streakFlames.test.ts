import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Node needs URL exports for the SVG imports normally handled by Vite.
const assetHooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.svg') && url.includes('/assets/streak-flames/')) {
      return { format: 'module', source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { EMPTY_STREAK_FLAME, STREAK_FLAME_VARIANTS, getStreakFlameVariant, getStreakTierProgress } = await import('../src/lib/streakFlames.ts');
assetHooks.deregister();

test('the approved 17 milestones resolve to existing Flow assets', () => {
  assert.deepEqual(STREAK_FLAME_VARIANTS.map(tier => tier.threshold),
    [1, 2, 4, 7, 10, 14, 21, 30, 45, 60, 75, 100, 150, 200, 250, 300, 365]);
  assert.equal(new Set(STREAK_FLAME_VARIANTS.map(tier => tier.key)).size, 17);
  for (const tier of STREAK_FLAME_VARIANTS) {
    assert.ok(tier.assetUrl.includes('/streak-flames/flow/'));
    assert.ok(existsSync(new URL(tier.assetUrl)), `Missing artwork for day ${tier.threshold}`);
  }
});

test('each milestone unlocks exactly at its threshold and targets the following tier', () => {
  for (let index = 0; index < STREAK_FLAME_VARIANTS.length; index++) {
    const tier = STREAK_FLAME_VARIANTS[index];
    const previous = STREAK_FLAME_VARIANTS[index - 1] ?? EMPTY_STREAK_FLAME;
    const next = STREAK_FLAME_VARIANTS[index + 1] ?? null;
    assert.equal(getStreakFlameVariant(tier.threshold - 1), previous);
    assert.equal(getStreakFlameVariant(tier.threshold), tier);
    const progress = getStreakTierProgress(tier.threshold);
    assert.equal(progress.currentTier, tier);
    assert.equal(progress.nextTier, next);
    assert.equal(progress.currentTierUnlocked, true);
    assert.equal(progress.daysRemainingToNext, next ? next.threshold - tier.threshold : 0);
    assert.equal(progress.progressCurrentValue, tier.threshold);
    assert.equal(progress.progressMaxValue, next?.threshold ?? tier.threshold);
    assert.equal(progress.progressRatio, next ? tier.threshold / next.threshold : 1);
  }
});

test('new and reset streaks work toward the first-day flame', () => {
  for (const streak of [0, -10, 0.9]) {
    const progress = getStreakTierProgress(streak);
    assert.equal(progress.currentTierUnlocked, false);
    assert.equal(progress.currentTier, EMPTY_STREAK_FLAME);
    assert.equal(progress.nextTier?.threshold, 1);
    assert.equal(progress.daysRemainingToNext, 1);
    assert.equal(progress.progressCurrentValue, 0);
    assert.equal(progress.progressMaxValue, 1);
  }
});

test('zero streaks use distinct unlit artwork without changing the first unlock', () => {
  assert.ok(existsSync(new URL(EMPTY_STREAK_FLAME.assetUrl)));
  assert.equal(EMPTY_STREAK_FLAME.threshold, 0);
  assert.equal(EMPTY_STREAK_FLAME.key, 'dormant');
  for (const streak of [0, -1, 0.9]) {
    assert.equal(getStreakFlameVariant(streak), EMPTY_STREAK_FLAME);
  }
  const firstDay = getStreakFlameVariant(1);
  assert.notEqual(firstDay.assetUrl, EMPTY_STREAK_FLAME.assetUrl);
  assert.equal(firstDay, STREAK_FLAME_VARIANTS[0]);
  assert.equal(getStreakTierProgress(0).nextTier, firstDay);
  assert.equal(getStreakTierProgress(1).currentTierUnlocked, true);
});

test('the bar uses the total streak toward the next milestone', () => {
  for (const [streak, target] of [[21, 30], [29, 30], [30, 45], [364, 365]]) {
    const progress = getStreakTierProgress(streak);
    assert.equal(progress.progressCurrentValue, streak);
    assert.equal(progress.progressMaxValue, target);
    assert.equal(progress.progressRatio, streak / target);
  }
});

test('rainbow milestones use total progress and the one-year reward stays full', () => {
  const progress = getStreakTierProgress(125.9);
  assert.equal(progress.currentTier.threshold, 100);
  assert.equal(progress.nextTier?.threshold, 150);
  assert.equal(progress.progressCurrentValue, 125);
  assert.equal(progress.progressMaxValue, 150);
  assert.equal(progress.progressRatio, 125 / 150);
  assert.equal(getStreakTierProgress(364).daysRemainingToNext, 1);
  for (const streak of [365, 366, 1000]) {
    const peak = getStreakTierProgress(streak);
    assert.equal(peak.currentTier.threshold, 365);
    assert.equal(peak.nextTier, null);
    assert.equal(peak.progressCurrentValue, 365);
    assert.equal(peak.progressMaxValue, 365);
    assert.equal(peak.progressRatio, 1);
  }
});
