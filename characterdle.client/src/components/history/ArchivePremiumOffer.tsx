import { PremiumCrownIcon } from '../ui/PremiumCrownIcon';
import { RouteLink } from '../ui/RouteLink';
import './ArchivePremiumOffer.css';

interface ArchivePremiumOfferProps {
  isAuthenticated: boolean;
  monthlyTrialDays: number;
  yearlyTrialDays?: number;
  onUpgrade: () => void;
}

export function ArchivePremiumOffer({ isAuthenticated, monthlyTrialDays, yearlyTrialDays = 0, onUpgrade }: ArchivePremiumOfferProps) {
  const trialDays = monthlyTrialDays > 0 ? monthlyTrialDays : yearlyTrialDays;
  const showTrialOffer = !isAuthenticated || trialDays > 0;
  const trialBillingCopy = monthlyTrialDays > 0
    ? monthlyTrialDays === yearlyTrialDays
      ? 'Then $3.99/month or $23.99/year. Cancel anytime.'
      : '$3.99/month after trial. Cancel anytime.'
    : '$23.99/year after trial. Cancel anytime.';

  return (
    <aside className="archive-premium-offer" aria-label="Unlock the archive with Premium">
      <PremiumCrownIcon className="archive-premium-offer__icon" />
      <div className="archive-premium-offer__copy">
        <h2>Unlock with Premium</h2>
        <p>{!isAuthenticated
          ? <>Play every archived game with a <strong>free 3-day trial</strong>.</>
          : showTrialOffer
            ? <>Play every archived game free for <strong>{trialDays} days</strong>.</>
            : <>Play every archived game for <strong>under 50&cent; a week</strong> with yearly Premium.</>}
        </p>
      </div>
      <div className="archive-premium-offer__actions">
        <RouteLink className="primary-button" href="/premium" onNavigate={onUpgrade}>
          {showTrialOffer ? 'Start Free Trial' : 'Go Premium'}
        </RouteLink>
        {isAuthenticated && (
          <span className="archive-premium-offer__detail">
            {showTrialOffer ? trialBillingCopy : '$23.99/year, billed annually.'}
          </span>
        )}
      </div>
    </aside>
  );
}
