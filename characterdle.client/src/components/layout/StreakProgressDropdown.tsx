import lockClosedIcon from '../../assets/lock-closed-heroicons.svg';
import { formatStreakDayLabel, getStreakTierProgress } from '../../lib/streakFlames';
import { StreakEmblem } from '../ui/StreakEmblem';

interface StreakProgressDropdownProps {
  availableStreakSavers: number;
  hasStreakProtection: boolean;
  streak: number;
}

export function StreakProgressDropdown({
  availableStreakSavers,
  hasStreakProtection,
  streak,
}: StreakProgressDropdownProps) {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const {
    currentTier,
    currentTierUnlocked,
    daysRemainingToNext,
    nextTier,
    progressCurrentValue,
    progressMaxValue,
    progressRatio,
  } = getStreakTierProgress(normalizedStreak);

  const currentTierCopy = currentTierUnlocked
    ? `Unlocked at ${formatStreakDayLabel(currentTier.threshold)}`
    : `Starts at ${formatStreakDayLabel(currentTier.threshold)}`;
  const nextTierCopy = nextTier
    ? `Unlocks at ${formatStreakDayLabel(nextTier.threshold)}`
    : `Top flame unlocked`;
  const progressHeading = nextTier
    ? `${formatStreakDayLabel(daysRemainingToNext)} to next flame`
    : 'Top streak flame unlocked';
  const progressCaption = nextTier
    ? `${progressCurrentValue} / ${progressMaxValue} days`
    : `${formatStreakDayLabel(normalizedStreak)} streak`;
  const streakSaverCount = hasStreakProtection
    ? availableStreakSavers
    : 0;

  return (
    <section className="streak-dropdown glass-card" aria-label="Streak progress">
      <div className="streak-dropdown-tier">
        <p className="streak-dropdown-label">Current</p>
        <StreakEmblem
          className={!currentTierUnlocked ? 'is-preview' : undefined}
          showCount={false}
          size="regular"
          streak={currentTier.threshold}
        />
        <p className="streak-dropdown-threshold">{currentTierCopy}</p>
      </div>

      <div className="streak-dropdown-progress">
        <p className="streak-dropdown-heading">{progressHeading}</p>
        <div
          className="streak-dropdown-progress-bar"
          aria-label={progressCaption}
          aria-valuemax={progressMaxValue}
          aria-valuemin={0}
          aria-valuenow={nextTier ? progressCurrentValue : progressMaxValue}
          role="progressbar"
        >
          <span className="streak-dropdown-progress-fill" style={{ width: `${progressRatio * 100}%` }} />
        </div>
        <p className="streak-dropdown-progress-copy">{progressCaption}</p>
      </div>

      <div className="streak-dropdown-tier is-next">
        <p className="streak-dropdown-label">{nextTier ? 'Next' : 'Peak'}</p>
        <StreakEmblem
          className={nextTier ? 'is-preview' : undefined}
          showCount={false}
          size="regular"
          streak={nextTier?.threshold ?? currentTier.threshold}
        />
        <p className="streak-dropdown-threshold">{nextTierCopy}</p>
      </div>

      <div className={`streak-dropdown-savers${hasStreakProtection ? '' : ' is-locked'}`}>
        {hasStreakProtection ? (
          <div className="streak-dropdown-tooltip-wrap">
            <button className="streak-dropdown-savers-trigger" type="button" aria-describedby="streak-saver-auto-use-tooltip">
              <span className="streak-dropdown-label">Streak savers</span>
              <span className="streak-dropdown-savers-value">{streakSaverCount}</span>
            </button>
            <div
              id="streak-saver-auto-use-tooltip"
              className="streak-dropdown-tooltip-panel"
              role="tooltip"
            >
              If your streak would expire, an available streak saver is used automatically to protect it.
            </div>
          </div>
        ) : (
          <div className="streak-dropdown-savers-trigger is-locked-row">
            <span className="streak-dropdown-label">Streak savers</span>
            <span
              className="streak-dropdown-savers-lock"
              role="img"
              tabIndex={0}
              aria-label="Premium required"
              aria-describedby="streak-saver-premium-tooltip"
            >
              <img src={lockClosedIcon} alt="" aria-hidden="true" />
              <span
                className="streak-dropdown-premium-tooltip"
                id="streak-saver-premium-tooltip"
                role="tooltip"
              >
                Premium required
              </span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
