import { useMemo, useState } from 'react';
import { PremiumCrownIcon } from '../components/ui/PremiumCrownIcon';
import type { AuthMode, NavigateToPage } from '../types/routes';
import type { BillingCheckoutPlan } from '../types/billing';
import type { PremiumAccess } from '../types/premium';

interface PremiumPageProps {
  isAuthenticated: boolean;
  isPremiumLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenBillingPortal: () => Promise<void>;
  onStartCheckout: (plan: BillingCheckoutPlan) => Promise<void>;
  premiumAccess: PremiumAccess | null;
}

interface PremiumFeature {
  detail: string;
  title: string;
}

const livePremiumFeatures: PremiumFeature[] = [
  {
    title: 'Ad-free play',
    detail: 'Remove the ad layer while you are logged in with Premium so the game board stays front and center.',
  },
  {
    title: 'Full archive access',
    detail: 'Open the entire archive instead of being limited to only the three most recent previous games.',
  },
  {
    title: 'Random practice games',
    detail: 'Spin up unlimited random character and quote rounds pulled directly from the live database without touching daily stats, streaks, archives, or leaderboards.',
  },
  {
    title: 'Streak protection',
    detail: 'Receive one streak saver each billing cycle and choose whether it should be used automatically to preserve your daily character streak.',
  },
  {
    title: 'Supporter styling',
    detail: 'Show your premium supporter treatment across your profile, avatar presentation, and leaderboard presence.',
  },
];

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function PremiumPage({
  isAuthenticated,
  isPremiumLoading,
  onAuthNavigate,
  onNavigate,
  onOpenBillingPortal,
  onStartCheckout,
  premiumAccess,
}: PremiumPageProps) {
  const [actionError, setActionError] = useState<string>();
  const [busyAction, setBusyAction] = useState<'monthly' | 'yearly' | 'portal' | null>(null);
  const isPremiumActive = premiumAccess?.isPremium === true;
  const renewalDate = useMemo(
    () => formatDate(premiumAccess?.currentPeriodEnd ?? null),
    [premiumAccess?.currentPeriodEnd],
  );
  const premiumStatusCopy = isPremiumActive
    ? premiumAccess?.cancelAtPeriodEnd && renewalDate
      ? `Premium stays active through ${renewalDate}, and then it will end unless you renew.`
      : renewalDate
        ? `Premium is active. Your current billing period is set through ${renewalDate}.`
        : 'Premium is active on this account.'
    : 'Upgrade to unlock the full Characterdle Premium experience on this account.';

  async function handleCheckout(plan: BillingCheckoutPlan) {
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
      <section className="glass-card premium-hero">
        <div className="premium-hero-copy">
          <span className="pill premium-hero-pill">
            <PremiumCrownIcon className="premium-hero-pill-icon" />
            Characterdle Premium
          </span>
          <h1>Upgrade the way you play.</h1>
          <p className="muted-copy">
            Premium gives you the full archive, ad-free play, random practice games, streak protection,
            and supporter styling across the site.
          </p>
          <p className="premium-status-copy">{premiumStatusCopy}</p>
          <div className="premium-hero-actions">
            {isAuthenticated ? (
              isPremiumActive ? (
                <button
                  className="secondary-button premium-hero-button"
                  type="button"
                  disabled={busyAction === 'portal'}
                  onClick={() => { void handleOpenPortal(); }}
                >
                  {busyAction === 'portal' ? 'Opening...' : 'Manage Billing'}
                </button>
              ) : (
                <>
                  <button
                    className="primary-button premium-hero-button"
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => { void handleCheckout('monthly'); }}
                  >
                    {busyAction === 'monthly' ? 'Redirecting...' : 'Start Monthly Premium'}
                  </button>
                  <button
                    className="secondary-button premium-hero-button"
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => { void handleCheckout('yearly'); }}
                  >
                    {busyAction === 'yearly' ? 'Redirecting...' : 'Choose Yearly Premium'}
                  </button>
                </>
              )
            ) : (
              <>
                <button className="primary-button premium-hero-button" type="button" onClick={() => onAuthNavigate('signup')}>
                  Create Account
                </button>
                <button className="secondary-button premium-hero-button" type="button" onClick={() => onAuthNavigate('login')}>
                  Log In
                </button>
              </>
            )}
            <button className="secondary-button premium-hero-button" type="button" onClick={() => onNavigate('launcher')}>
              Back Home
            </button>
          </div>
          {actionError && <p className="error-copy premium-action-error">{actionError}</p>}
        </div>

        <div className="premium-pricing-grid" aria-label="Premium pricing">
          <article className="glass-card premium-plan-card is-featured">
            <div className="premium-plan-badge-row">
              <span className="pill">Monthly</span>
              <span className="premium-plan-note">3-day trial</span>
            </div>
            <div className="premium-plan-price-block">
              <strong>$3.99</strong>
              <span>per month</span>
            </div>
            <p className="muted-copy">
              Start with the monthly plan to unlock premium right away, including full archive access,
              random practice games, and streak protection.
            </p>
            {isAuthenticated ? (
              isPremiumActive ? (
                <button className="primary-button premium-plan-button" disabled type="button">
                  Premium Active
                </button>
              ) : (
                <button
                  className="primary-button premium-plan-button"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => { void handleCheckout('monthly'); }}
                >
                  {busyAction === 'monthly' ? 'Redirecting...' : 'Start 3-Day Trial'}
                </button>
              )
            ) : (
              <button className="primary-button premium-plan-button" type="button" onClick={() => onAuthNavigate('signup')}>
                Sign Up to Upgrade
              </button>
            )}
          </article>

          <article className="glass-card premium-plan-card">
            <div className="premium-plan-badge-row">
              <span className="pill">Yearly</span>
              <span className="premium-plan-note">Save 50%</span>
            </div>
            <div className="premium-plan-price-block">
              <strong>$23.99</strong>
              <span>per year</span>
            </div>
            <p className="muted-copy">
              Best for daily players who want the full archive, supporter perks, and the best long-term rate.
            </p>
            {isAuthenticated ? (
              isPremiumActive ? (
                <button className="secondary-button premium-plan-button" disabled type="button">
                  Premium Active
                </button>
              ) : (
                <button
                  className="secondary-button premium-plan-button"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => { void handleCheckout('yearly'); }}
                >
                  {busyAction === 'yearly' ? 'Redirecting...' : 'Go Yearly'}
                </button>
              )
            ) : (
              <button className="secondary-button premium-plan-button" type="button" onClick={() => onAuthNavigate('login')}>
                Log In to Upgrade
              </button>
            )}
          </article>
        </div>
      </section>

      <section className="glass-card premium-benefit-column" aria-label="Premium benefits">
        <div className="premium-section-heading">
          <p className="card-kicker">Available now</p>
          <h2>What Premium unlocks</h2>
        </div>
        <div className="premium-benefit-list">
          {livePremiumFeatures.map((feature) => (
            <article key={feature.title} className="premium-benefit-item">
              <div className="premium-benefit-topline">
                <h3>{feature.title}</h3>
                <span className="pill premium-benefit-pill is-live">Live</span>
              </div>
              <p className="muted-copy">{feature.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-card premium-details-panel">
        <div className="premium-section-heading">
          <p className="card-kicker">Subscription details</p>
          <h2>Simple pricing, flexible management</h2>
        </div>
        <div className="premium-detail-grid">
          <article>
            <h3>Billing</h3>
            <p className="muted-copy">
              Monthly Premium starts at $3.99 with a 3-day trial. Yearly Premium is $23.99 and is the lowest effective weekly cost.
            </p>
          </article>
          <article>
            <h3>Cancellation</h3>
            <p className="muted-copy">
              Billing is managed through Stripe, so you can return to the billing portal anytime to review, cancel, or update payment details.
            </p>
          </article>
          <article>
            <h3>Account access</h3>
            <p className="muted-copy">
              Premium follows your account, not the browser, so your supporter perks and archive access stay with you anywhere you log in.
            </p>
          </article>
          <article>
            <h3>Status</h3>
            <p className="muted-copy">
              {isPremiumLoading
                ? 'Checking your current premium access now.'
                : isPremiumActive
                  ? 'Your account is currently recognized as Premium.'
                  : 'Your account is currently on the free tier.'}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
