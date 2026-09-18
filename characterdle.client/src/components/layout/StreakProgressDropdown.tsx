import lockClosedIcon from '../../assets/lock-closed-heroicons.svg';
import { formatStreakDayLabel, getStreakTierProgress } from '../../lib/streakFlames';
import { StreakEmblem } from '../ui/StreakEmblem';

interface StreakProgressDropdownProps {
  autoUseStreakSavers: boolean;
  availableStreakSavers: number;
  hasStreakProtection: boolean;
  streak: number;
}

export function StreakProgressDropdown({
  autoUseStreakSavers,
  availableStreakSavers,
  hasStreakProtection,
  streak,
}: StreakProgressDropdownProps) {
  const normalizedStreak = Math.max(0, Math.trunc(streak));
  const {
    currentTier,
    currentTierUnlocked,
    nextTier,
    progressCurrentValue,
    progressMaxValue,
    progressRatio,
  } = getStreakTierProgress(normalizedStreak);

  const currentTierCopy = currentTierUnlocked
    ? `Unlocked at ${formatStreakDayLabel(currentTier.threshold)}`
    : 'No active streak';
  const nextTierCopy = nextTier
    ? `Unlocks at ${formatStreakDayLabel(nextTier.threshold)}`
    : 'Final milestone reached';
  const progressHeading = nextTier
    ? 'Next Milestone'
    : 'All Milestones Reached';
  const progressCaption = `${progressCurrentValue}/${progressMaxValue} days`;
  const progressValueText = nextTier
    ? `${progressCurrentValue} of ${progressMaxValue} days toward the next milestone`
    : 'All streak milestones reached';
  const streakSaverCount = hasStreakProtection
    ? availableStreakSavers
    : 0;

  return (
    <section className="streak-dropdown glass-card" aria-label="Streak progress">
      <div className="streak-dropdown-tier">
        <p className="streak-dropdown-label">Current</p>
        <StreakEmblem
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
          aria-label="Streak milestone progress"
          aria-valuemax={progressMaxValue}
          aria-valuemin={0}
          aria-valuenow={progressCurrentValue}
          aria-valuetext={progressValueText}
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
              {autoUseStreakSavers
                ? 'If your streak would expire, an available streak saver is used automatically to protect it.'
                : 'Automatic streak saver use is turned off in Settings, so saved charges stay on your account until you re-enable it.'}
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
