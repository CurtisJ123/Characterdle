import { createRoot } from 'react-dom/client';
import { SiteHeader } from '../../src/components/layout/SiteHeader';
import { PreviousGamesGrid } from '../../src/components/history/PreviousGamesGrid';
import { ArchivePremiumOffer } from '../../src/components/history/ArchivePremiumOffer';
import { PremiumPage } from '../../src/pages/PremiumPage';
import type { PremiumAccess } from '../../src/types/premium';
import type { GameMode } from '../../src/types/game';
import type { AccountDeletionStatus } from '../../src/types/auth';
import '../../src/index.css';
import '../../src/App.css';
import '../../src/styles/history.css';

const params = new URLSearchParams(location.search);
const state = params.get('state') ?? 'eligible';
const mode = (params.get('mode') ?? 'character') as GameMode;
const active = state === 'premium';
const authenticated = state !== 'guest';
const trialDays = state === 'eligible' || state === 'monthly-only' ? 3 : 0;
const yearlyTrialDays = state === 'eligible' || state === 'yearly-only' ? 3 : 0;
const loading = state === 'loading';
const previewPremium = params.get('page') === 'premium';
const navigate = (page: string) => { document.documentElement.dataset.navigation = page; };
const noop = () => {};
const games = Array.from({ length: 22 }, (_, index) => ({ id: 108 - index, dateTime: '2026-10-07T04:00:00Z' }));
const access: PremiumAccess = {
  isPremium: active, monthlyTrialDays: loading ? 3 : trialDays, yearlyTrialDays: loading ? 3 : yearlyTrialDays,
  planCode: active ? 'premium' : null, subscriptionStatus: active ? 'active' : 'inactive',
  billedPriceCents: null, currencyCode: 'USD', currentPeriodStart: null,
  currentPeriodEnd: active ? '2026-11-07T12:00:00Z' : null,
  cancelAt: null, cancelAtPeriodEnd: false, billingDiscountCode: null,
  adFree: active, practiceMode: active, profileCustomization: active, supporterBadge: active,
  fullArchiveAccess: active, archiveLookbackDays: active ? 36500 : 3,
  streakProtection: active, streakSaversPerCycle: active ? 1 : 0, availableStreakSavers: 0,
  autoUseStreakSavers: true,
};
async function checkout(plan: string) {
  navigate(`checkout:${plan}`);
  if (params.has('fail')) throw new Error('Checkout unavailable. Please try again.');
}
async function portal() {
  navigate('billing-portal');
  if (params.has('fail')) throw new Error('Billing portal unavailable. Please try again.');
}

createRoot(document.getElementById('root')!).render(
  <div className="app-shell">
    <SiteHeader currentPage={previewPremium ? 'premium' : 'history'} currentGameMode={mode} universeId="got" currentStreak={10}
      isAuthenticated={authenticated} isUserLoading={false} isPremiumLoading={loading}
      isPremiumActive={active} isPremiumUser={active} monthlyTrialDays={trialDays} yearlyTrialDays={yearlyTrialDays}
      autoUseStreakSavers hasStreakProtection={active} currentStreakSaverSettingEnabled={active} availableStreakSavers={0}
      onNavigate={navigate} onAuthNavigate={noop} onSignOut={noop} onOpenBillingPortal={async () => {}}
      onSaveSettings={async () => ''} onDeleteAccount={async () => ''}
      onLoadAccountDeletionStatus={async () => ({} as AccountDeletionStatus)} userDisplayName="Test Player" />
    {previewPremium ? (
      <PremiumPage isAuthenticated={authenticated} isPremiumLoading={loading}
        premiumAccess={authenticated && state !== 'unknown' ? access : null}
        onNavigate={navigate} onAuthNavigate={value => navigate(`auth:${value}`)}
        onStartCheckout={checkout} onOpenBillingPortal={portal} />
    ) : <main className="page archive-page">
      <section className="archive-shell">
        <div className="archive-status-bar glass-card">
          <div className="archive-status-copy"><p className="card-kicker">Character archive</p><h2>108 character boards</h2></div>
          <div className="archive-mode-toggle" aria-label="Archive mode">
            {(['character', 'quote', 'episode_ladder'] as const).map(value => (
              <a key={value} className={`archive-mode-link${mode === value ? ' is-active' : ''}`}
                href={`?state=${state}&mode=${value}`}>{value === 'episode_ladder' ? 'Episode Ladder' : value}</a>
            ))}
          </div>
        </div>
        <PreviousGamesGrid games={games} currentGameId={108} gameMode={mode}
          accessibleGameCount={active ? Number.MAX_SAFE_INTEGER : 3} gameOutcomes={new Map()}
          onOpenGame={id => navigate(`game:${id ?? 'today'}`)} universeTitle="Game of Thrones" universeId="got"
          premiumOffer={<ArchivePremiumOffer isAuthenticated={authenticated} monthlyTrialDays={trialDays}
            yearlyTrialDays={yearlyTrialDays} onUpgrade={() => navigate('premium')} />} />
      </section>
    </main>}
  </div>,
);
