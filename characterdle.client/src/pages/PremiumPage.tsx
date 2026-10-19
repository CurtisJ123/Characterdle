import { useMemo, useState } from 'react';
import calendarIcon from '../assets/calendar-days-heroicons.svg';
import { DiceIcon } from '../components/ui/DiceIcon';
import { PremiumCrownIcon } from '../components/ui/PremiumCrownIcon';
import type { AuthMode, NavigateToPage } from '../types/routes';
import type { BillingCheckoutPlan } from '../types/billing';
import type { PremiumAccess } from '../types/premium';
import './PremiumPage.css';

interface PremiumPageProps {
  isAuthenticated: boolean;
  isPremiumLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenBillingPortal: () => Promise<void>;
  onStartCheckout: (plan: BillingCheckoutPlan) => Promise<void>;
  premiumAccess: PremiumAccess | null;
}

const premiumFeatures = [
  { title: 'Full archive access', detail: 'Every past Character, Quote, and Episode Ladder game.' },
  { title: 'Unlimited practice', detail: 'Random games without affecting daily stats or leaderboards.' },
  { title: 'Streak protection', detail: 'One streak saver each month, with optional automatic use.' },
  { title: 'Premium styling', detail: 'Premium styling for your profile and avatar, plus your leaderboard badge.' },
];

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function PremiumPage({
  isAuthenticated,
  isPremiumLoading,
  onAuthNavigate,
  onOpenBillingPortal,
  onStartCheckout,
  premiumAccess,
}: PremiumPageProps) {
  const [actionError, setActionError] = useState<string>();
  const [busyAction, setBusyAction] = useState<'monthly' | 'yearly' | 'portal' | null>(null);
  const isPremiumActive = isAuthenticated && premiumAccess?.isPremium === true;
  const trialDays = isAuthenticated && !isPremiumLoading && !isPremiumActive
    ? premiumAccess?.monthlyTrialDays ?? 0 : 0;
  const yearlyTrialDays = isAuthenticated && !isPremiumLoading && !isPremiumActive
    ? premiumAccess?.yearlyTrialDays ?? 0 : 0;
  const checkoutDisabled = isPremiumLoading || isPremiumActive || busyAction !== null;
  const renewalDate = useMemo(
    () => formatDate(premiumAccess?.currentPeriodEnd ?? null),
    [premiumAccess?.currentPeriodEnd],
  );
  const scheduledCancellationDate = useMemo(
    () => formatDate(
      premiumAccess?.cancelAt
      ?? (premiumAccess?.cancelAtPeriodEnd ? premiumAccess?.currentPeriodEnd ?? null : null),
    ),
    [premiumAccess?.cancelAt, premiumAccess?.cancelAtPeriodEnd, premiumAccess?.currentPeriodEnd],
  );
  const premiumStatusCopy = scheduledCancellationDate
    ? `Premium is active until ${scheduledCancellationDate}. Your subscription will not renew.`
    : renewalDate
      ? `Premium is active. Current billing period ends ${renewalDate}.`
      : 'Premium is active on your account.';

  async function handleCheckout(plan: BillingCheckoutPlan) {
    if (checkoutDisabled) return;
    if (!isAuthenticated) {
      onAuthNavigate('signup');
      return;
    }
    setActionError(undefined);
    setBusyAction(plan);
    try {
      await onStartCheckout(plan);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to start checkout.');
      setBusyAction(null);
    }
  }

  async function handleOpenPortal() {
    setActionError(undefined);
    setBusyAction('portal');
    try {
      await onOpenBillingPortal();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to open billing portal.');
      setBusyAction(null);
    }
  }

  return (
    <main className="page premium-page">
      <section className="premium-hero" aria-labelledby="premium-title">
        <header className="premium-hero-copy">
          <PremiumCrownIcon className="premium-hero-icon" />
          <h1 id="premium-title">Characterdle Premium</h1>
          <ul className="premium-hero-perks" aria-label="Included in both plans">
            <li><img className="premium-perk-icon" src={calendarIcon} alt="" />Full archive</li>
            <li><DiceIcon className="premium-perk-icon" />Unlimited practice</li>
            <li><span className="premium-perk-icon premium-perk-icon--streak" aria-hidden="true" />Streak protection</li>
          </ul>
        </header>

        {isPremiumLoading ? (
          <p className="premium-status-copy" role="status">Checking your subscription...</p>
        ) : isPremiumActive && (
          <div className="premium-account-status">
            <p className="premium-status-copy">{premiumStatusCopy}</p>
            <button className="secondary-button" type="button" disabled={busyAction !== null}
              onClick={() => { void handleOpenPortal(); }}>
              {busyAction === 'portal' ? 'Opening...' : 'Manage Billing'}
            </button>
          </div>
        )}

        <div className="premium-pricing-grid" aria-label="Premium pricing">
          <article className="premium-plan-card" aria-labelledby="premium-monthly-title">
            <div className="premium-plan-heading">
              <h2 id="premium-monthly-title">Monthly</h2>
              <span className="premium-plan-note">{trialDays > 0 ? `${trialDays}-day free trial` : 'Billed monthly'}</span>
            </div>
            <div className="premium-plan-price-block">
              <strong>$3.99</strong><span>/ month</span>
            </div>
            <p className="premium-plan-billing">
              {trialDays > 0 ? `Free for ${trialDays} days, then $3.99/month.` : '$3.99 billed monthly. Cancel anytime.'}
            </p>
            <button className="secondary-button premium-plan-button" type="button" disabled={checkoutDisabled}
              onClick={() => { void handleCheckout('monthly'); }}>
              {isPremiumLoading ? 'Checking...' : isPremiumActive ? 'Premium Active' : busyAction === 'monthly'
                ? 'Redirecting...' : trialDays > 0 ? 'Start Free Trial' : 'Choose Monthly'}
            </button>
          </article>

          <article className="premium-plan-card is-featured" aria-labelledby="premium-yearly-title">
            <div className="premium-plan-heading">
              <h2 id="premium-yearly-title">Yearly</h2>
              <strong className="premium-savings-badge">50% OFF</strong>
            </div>
            <div className="premium-plan-price-block">
              <strong>$23.99</strong><span>/ year</span>
            </div>
            <p className="premium-plan-billing premium-yearly-comparison">
              <s>$47.88</s> compared with 12 monthly payments.
            </p>
            <p className="premium-yearly-rate">{yearlyTrialDays > 0
              ? <><strong>{yearlyTrialDays}-day free trial</strong>, then $23.99/year.</>
              : <>Under <strong>50&cent;</strong> a week. Billed $23.99 annually.</>}
            </p>
            <button className="primary-button premium-plan-button" type="button" disabled={checkoutDisabled}
              onClick={() => { void handleCheckout('yearly'); }}>
              {isPremiumLoading ? 'Checking...' : isPremiumActive ? 'Premium Active'
                : busyAction === 'yearly' ? 'Redirecting...' : yearlyTrialDays > 0 ? 'Start Free Trial' : 'Choose Yearly'}
            </button>
          </article>
        </div>

        {actionError && <p className="error-copy premium-action-error" role="alert">{actionError}</p>}
        <div className="premium-checkout-note">
          <p>Both plans include all Premium features. Cancel anytime.</p>
          <p>Checkout with Stripe.</p>
          {!isAuthenticated && <p>Already have an account?{' '}
            <button className="premium-login-link" type="button" onClick={() => onAuthNavigate('login')}>Log in</button>
          </p>}
        </div>
      </section>

      <section className="premium-details" aria-label="More about Premium">
        <details className="premium-details-section">
          <summary>What&apos;s included</summary>
          <div className="premium-detail-grid">
            {premiumFeatures.map(feature => (
              <article key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.detail}</p>
              </article>
            ))}
          </div>
        </details>
        <details className="premium-details-section">
          <summary>Billing &amp; cancellation</summary>
          <div className="premium-detail-grid">
            <article>
              <h3>Billing</h3>
              <p>{trialDays > 0
                ? `Monthly includes a ${trialDays}-day free trial, then renews at $3.99/month.`
                : 'Monthly renews at $3.99/month.'}
                {' '}{yearlyTrialDays > 0
                  ? `Yearly includes a ${yearlyTrialDays}-day free trial, then renews at $23.99/year.`
                  : 'Yearly is billed at $23.99/year.'}
                {' '}Both plans renew automatically until canceled.</p>
            </article>
            <article>
              <h3>Cancellation</h3>
              <p>Cancel or update your payment details through Manage Billing. Your access lasts until the end of your current period.</p>
            </article>
            <article>
              <h3>Your account</h3>
              <p>Premium works wherever you sign in to your Characterdle account.</p>
            </article>
          </div>
        </details>
      </section>
    </main>
  );
}
