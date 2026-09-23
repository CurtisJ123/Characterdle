import { lazy, useEffect, useEffectEvent, useState } from 'react';
import { ArchiveRouteGuard } from './ArchiveRouteGuard';
import { buildRoutePath } from '../../lib/routePaths';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import type { useAnnouncements } from '../../hooks/useAnnouncements';
import { AnnouncementPopup } from '../updates/AnnouncementPopup';
import { DeferredContent } from '../ui/DeferredContent';
import { getWarmedEpisodeLadderPage, initialPageComponents, pageModules } from '../../lib/pageModules';
import type { EpisodeLadderPageProps } from '../../pages/EpisodeLadderPage';
import { usePremium } from '../../hooks/usePremium';
import { useProfile } from '../../hooks/useProfile';
import { useUniverse } from '../../hooks/useUniverse';
import { createBillingCheckoutSession, createBillingPortalSession } from '../../services/billingApi';
import {
  cacheUniverseGameResults,
  getGameProgressOwnerKey,
  syncPersistedGameResultsToLocalProgress,
} from '../../lib/characterGameProgress';
import { flushUniverseGameResultOutbox } from '../../lib/gameResultOutbox';
import { LandingPage } from '../../pages/LandingPage';
import { getGameResults } from '../../services/profileApi';
import type { AccountSettingsValues } from '../../types/auth';
import type { BillingCheckoutPlan } from '../../types/billing';
import type { GameMode } from '../../types/game';
import type { UniverseStreak } from '../../types/leaderboard';
import type { PremiumAccess } from '../../types/premium';
import type { UniverseProfile } from '../../types/profile';
import type { AppRoute, AuthMode, NavigateToPage, Page } from '../../types/routes';

const DeferredAuthPage = lazy(pageModules.auth);
const DeferredAboutPage = lazy(pageModules.about);
const DeferredCharacterGamePage = lazy(pageModules.game);
const DeferredEpisodeLadderPage = lazy(pageModules.episodeLadder);
const DeferredRandomEpisodeLadderPage = lazy(pageModules.randomEpisodeLadder);
const DeferredHowToPlayPage = lazy(pageModules.howToPlay);
const DeferredLauncherPage = lazy(pageModules.launcher);
const DeferredLeaderboardPage = lazy(pageModules.leaderboard);
const DeferredLegalDocumentPage = lazy(pageModules.privacyPolicy);
const DeferredPreviousGamesPage = lazy(pageModules.history);
const DeferredPremiumPage = lazy(pageModules.premium);
const DeferredProfilePage = lazy(pageModules.profile);
const DeferredRandomGamePage = lazy(pageModules.random);
const DeferredSupportPage = lazy(pageModules.support);
const DeferredUpdatesPage = lazy(pageModules.updates);
const DeferredAdminPage = lazy(pageModules.admin);

function PreparedEpisodeLadderPage(props: EpisodeLadderPageProps) {
  // Fix the component choice for this mount, avoiding both Suspense delay and later remounts.
  const [Page] = useState(() => getWarmedEpisodeLadderPage() ?? DeferredEpisodeLadderPage);
  return <Page {...props} />;
}

interface LiveStreakState {
  scope: string;
  streak: UniverseStreak;
  profileAtUpdate: UniverseProfile | null;
}

type BillingRedirectStatus = 'success' | 'cancelled' | null;

interface AppShellProps {
  route: AppRoute;
  announcements: ReturnType<typeof useAnnouncements>;
  currentPostSlug?: string;
  authMode: AuthMode;
  currentPage: Page;
  currentGameId: number | null;
  currentGameMode: GameMode;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
  onOpenRandomGame: (gameMode: GameMode, universeId?: string) => void;
}

export function AppShell({
  route,
  announcements,
  currentPostSlug,
  authMode,
  currentGameId,
  currentGameMode,
  currentPage,
  onAuthNavigate,
  onNavigate,
  onOpenGame,
  onOpenHistory,
  onOpenRandomGame,
}: AppShellProps) {
  const AuthPage = initialPageComponents.auth ?? DeferredAuthPage;
  const AboutPage = initialPageComponents.about ?? DeferredAboutPage;
  const CharacterGamePage = initialPageComponents.game ?? DeferredCharacterGamePage;
  const EpisodeLadderPage = initialPageComponents.episodeLadder ?? PreparedEpisodeLadderPage;
  const RandomEpisodeLadderPage = initialPageComponents.randomEpisodeLadder ?? DeferredRandomEpisodeLadderPage;
  const HowToPlayPage = initialPageComponents.howToPlay ?? DeferredHowToPlayPage;
  const LauncherPage = initialPageComponents.launcher ?? DeferredLauncherPage;
  const LeaderboardPage = initialPageComponents.leaderboard ?? DeferredLeaderboardPage;
  const LegalDocumentPage = initialPageComponents.privacyPolicy ?? initialPageComponents.termsOfService ?? DeferredLegalDocumentPage;
  const PreviousGamesPage = initialPageComponents.history ?? DeferredPreviousGamesPage;
  const PremiumPage = initialPageComponents.premium ?? DeferredPremiumPage;
  const ProfilePage = initialPageComponents.profile ?? DeferredProfilePage;
  const RandomGamePage = initialPageComponents.random ?? DeferredRandomGamePage;
  const SupportPage = initialPageComponents.support ?? DeferredSupportPage;
  const UpdatesPage = initialPageComponents.updates ?? DeferredUpdatesPage;
  const AdminPage = initialPageComponents.admin ?? DeferredAdminPage;
  const {
    authError,
    deleteAccount,
    getAccountDeletionStatus,
    isAuthenticated,
    isLoading,
    session,
    signOut,
    updateAccount,
    user,
  } = useAuth();
  const { selectedUniverse } = useUniverse();
  const {
    data: profile,
    error: profileError,
    isLoading: isProfileLoading,
    reload: reloadProfile,
  } = useProfile(session?.access_token ?? null, selectedUniverse.id, user?.id ?? null);
  const {
    data: premiumData,
    isLoading: isPremiumLoading,
    reload: reloadPremium,
  } = usePremium(session?.access_token ?? null, user?.id ?? null);
  const applySyncedStreak = useEffectEvent((streak: UniverseStreak, completed: boolean) => handleStreakUpdated(streak, completed));
  const [liveStreak, setLiveStreak] = useState<LiveStreakState | null>(null);
  const streakScope = `${user?.id ?? 'guest'}:${selectedUniverse.id}`;
  const liveStreakForScope = liveStreak?.scope === streakScope && liveStreak.profileAtUpdate === profile
    ? liveStreak.streak
    : null;
  const billingRedirectStatus = (() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawValue = new URLSearchParams(window.location.search).get('billing');

    if (rawValue === 'success' || rawValue === 'cancelled') {
      return rawValue;
    }

    return null;
  })() as BillingRedirectStatus;
  const resolvedProfile: UniverseProfile | null = profile
    ? {
      ...profile,
      currentStreak: liveStreakForScope?.currentStreak ?? profile.currentStreak,
      longestStreak: liveStreakForScope?.longestStreak ?? profile.longestStreak,
    }
    : null;
  const currentStreak = liveStreakForScope?.currentStreak ?? resolvedProfile?.currentStreak ?? 0;
  const premiumAccess: PremiumAccess | null = premiumData?.access ?? null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ladder-session-changed', { detail: isLoading || isPremiumLoading ? 'loading'
      : `${user?.id ? `user:${user.id}` : 'guest'}:${premiumAccess?.fullArchiveAccess ? 'full' : 'limited'}` }));
  }, [user?.id, isLoading, isPremiumLoading, premiumAccess?.fullArchiveAccess]);
  const isPremiumActive = premiumAccess?.isPremium === true;
  const showSupporterBadge = premiumAccess?.supporterBadge === true;
  const refreshImportedProfile = useEffectEvent(() => { void reloadProfile(); });
  useEffect(() => {
    function onImported(event: Event) {
      if ((event as CustomEvent<{ userId: string }>).detail.userId === user?.id) refreshImportedProfile();
    }
    window.addEventListener('ladder-guest-imported', onImported);
    return () => window.removeEventListener('ladder-guest-imported', onImported);
  }, [user?.id]);
  const refreshBilling = useEffectEvent(() => { void reloadPremium(); });
  useEffect(() => {
    if (billingRedirectStatus !== 'success' || !user?.id || isPremiumActive) return;
    // Checkout can return before Stripe's webhook. Retry briefly without blanking the current UI.
    const timers = [2000, 5000, 10_000, 20_000].map(delay => window.setTimeout(refreshBilling, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [billingRedirectStatus, user?.id, isPremiumActive]);
  const shouldWarmSignedInResults = isAuthenticated
    && (currentPage === 'launcher' || currentPage === 'leaderboard' || currentPage === 'profile');

  useEffect(() => {
    if (!shouldWarmSignedInResults || !session?.access_token || !user) {
      return;
    }

    let isDisposed = false;
    const accessToken = session.access_token;
    const ownerKey = getGameProgressOwnerKey(user.id);

    async function warmSignedInResults() {
      try {
        const results = await getGameResults(accessToken, selectedUniverse.id);

        if (isDisposed) {
          return;
        }

        cacheUniverseGameResults(ownerKey, selectedUniverse.id, results);
        syncPersistedGameResultsToLocalProgress(ownerKey, selectedUniverse.id, results);
      } catch (error) {
        if (!isDisposed) {
          console.error(error);
        }
      }
    }

    void warmSignedInResults();

    return () => {
      isDisposed = true;
    };
  }, [selectedUniverse.id, session?.access_token, shouldWarmSignedInResults, user]);

  useEffect(() => {
    const currentUserId = user?.id;
    const currentAccessToken = session?.access_token;

    if (!currentUserId || !currentAccessToken) {
      return;
    }

    const userId = currentUserId;
    const accessToken = currentAccessToken;
    let isDisposed = false;
    let hasLoggedFailure = false;
    const universeId = selectedUniverse.id;

    async function flushPendingResults() {
      try {
        void import('../../lib/episodeLadderProgress')
          .then(({ migrateGuestLadderVictories }) => migrateGuestLadderVictories(userId, accessToken))
          .catch(error => console.error('Episode Ladder results will be retried.', error));
        const outcomes = await flushUniverseGameResultOutbox(userId, accessToken);

        if (isDisposed) {
          return;
        }

        hasLoggedFailure = false;

        const matching = outcomes.filter(outcome => outcome.universeId === universeId);
        const latest = matching.at(-1);
        if (latest) applySyncedStreak(latest.streak, matching.some(outcome => outcome.completed));
      } catch (error) {
        if (!isDisposed && !hasLoggedFailure) {
          console.error('Game results are queued and will be retried.', error);
          hasLoggedFailure = true;
        }
      }
    }

    function retryPendingResults() {
      void flushPendingResults();
    }

    function retryWhenVisible() {
      if (document.visibilityState === 'visible') {
        retryPendingResults();
      }
    }

    retryPendingResults();
    window.addEventListener('focus', retryPendingResults);
    window.addEventListener('online', retryPendingResults);
    document.addEventListener('visibilitychange', retryWhenVisible);
    const retryTimer = window.setInterval(retryPendingResults, 30_000);

    return () => {
      isDisposed = true;
      window.clearInterval(retryTimer);
      window.removeEventListener('focus', retryPendingResults);
      window.removeEventListener('online', retryPendingResults);
      document.removeEventListener('visibilitychange', retryWhenVisible);
    };
  }, [selectedUniverse.id, session?.access_token, user?.id]);

  function handleStreakUpdated(streak: UniverseStreak, completed = true) {
    setLiveStreak({
      scope: streakScope,
      streak,
      profileAtUpdate: profile,
    });
    if (completed) void reloadProfile().then(reloadPremium);
  }

  async function handleSignOut() {
    try {
      await signOut();
      onAuthNavigate('login');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveSettings(values: AccountSettingsValues) {
    const currentDisplayName = (user?.displayName ?? '').trim();
    const currentAvatarUrl = user?.avatarUrl ?? null;
    const nextDisplayName = values.displayName.trim();
    const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(values, 'avatarUrl');
    const nextAvatarUrl = hasAvatarUpdate
      ? values.avatarUrl?.trim() || null
      : null;
    const hasProfileChanges = nextDisplayName !== currentDisplayName
      || (hasAvatarUpdate && nextAvatarUrl !== currentAvatarUrl);
    const hasStreakSaverPreferenceChange = values.autoUseStreakSavers !== (premiumAccess?.autoUseStreakSavers ?? true);
    let profileMessage = 'No changes to save.';

    if (hasProfileChanges || hasStreakSaverPreferenceChange) {
      const result = await updateAccount(values);
      profileMessage = result.message;
    }

    await Promise.all([reloadProfile(), reloadPremium()]);

    return profileMessage;
  }

  async function handleDeleteAccount() {
    const result = await deleteAccount();
    setLiveStreak(null);
    onNavigate('launcher');
    return result.message;
  }

  async function handleStartCheckout(plan: BillingCheckoutPlan) {
    if (!session?.access_token) {
      throw new Error('You must be signed in to subscribe.');
    }

    const redirectUrl = await createBillingCheckoutSession(session.access_token, plan);
    window.location.assign(redirectUrl);
  }

  async function handleOpenBillingPortal() {
    if (!session?.access_token) {
      throw new Error('You must be signed in to manage billing.');
    }

    const redirectUrl = await createBillingPortalSession(session.access_token);
    window.location.assign(redirectUrl);
  }

  return (
    <div className="app-shell">
      <SiteHeader
        hasUnreadUpdates={announcements.unread}
        isAdmin={announcements.isAdmin}
        isPremiumActive={isPremiumActive}
        isPremiumUser={showSupporterBadge}
        isPremiumLoading={isPremiumLoading}
        autoUseStreakSavers={premiumAccess?.autoUseStreakSavers ?? true}
        availableStreakSavers={premiumAccess?.availableStreakSavers ?? 0}
        currentPage={currentPage}
        currentGameMode={currentGameMode}
        universeId={selectedUniverse.id}
        currentStreakSaverSettingEnabled={premiumAccess?.streakProtection === true}
        isAuthenticated={isAuthenticated}
        isUserLoading={isLoading}
        hasStreakProtection={premiumAccess?.streakProtection === true}
        onAuthNavigate={onAuthNavigate}
        onDeleteAccount={handleDeleteAccount}
        onLoadAccountDeletionStatus={getAccountDeletionStatus}
        onNavigate={onNavigate}
        onOpenBillingPortal={handleOpenBillingPortal}
        onSaveSettings={handleSaveSettings}
        onSignOut={handleSignOut}
        currentStreak={currentStreak}
        userAvatarUrl={user?.avatarUrl}
        userDisplayName={user?.displayName}
      />
      <DeferredContent resetKey={`${currentPage}:${currentGameMode}:${currentPostSlug ?? ''}`}>
      <ArchiveRouteGuard key={buildRoutePath(route)} route={route}>
      {currentPage === 'landing' && (
        <LandingPage isAuthenticated={isAuthenticated} onAuthNavigate={onAuthNavigate} onNavigate={onNavigate} />
      )}
      {currentPage === 'auth' && (
        <AuthPage
          initialMode={authMode}
          onAuthModeChange={onAuthNavigate}
          onNavigate={onNavigate}
        />
      )}
      {currentPage === 'launcher' && (
        <LauncherPage
          accessToken={session?.access_token ?? null}
          authError={authError}
          isPremiumUser={showSupporterBadge}
          isPremiumLoading={isPremiumLoading}
          fullArchiveAccess={premiumAccess?.fullArchiveAccess}
          isUserLoading={isLoading}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          user={user}
        />
      )}
      {currentPage === 'game' && currentGameMode === 'episode_ladder' && (
        <EpisodeLadderPage
          key={`ladder:${user?.id ?? 'guest'}:${currentGameId ?? 'current'}`}
          onStreakUpdated={handleStreakUpdated}
          onOpenRandomGame={onOpenRandomGame}
          premiumAccess={premiumAccess}
          isPremiumLoading={isPremiumLoading}
          selectedGameId={currentGameId}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          onStartCheckout={handleStartCheckout}
        />
      )}
      {currentPage === 'game' && currentGameMode !== 'episode_ladder' && (
        <CharacterGamePage
          key={user?.id ?? 'guest'}
          premiumAccess={premiumAccess}
          isPremiumLoading={isPremiumLoading}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          onOpenRandomGame={onOpenRandomGame}
          currentStreak={currentStreak}
          onStreakUpdated={handleStreakUpdated}
          selectedGameId={currentGameId}
          selectedGameMode={currentGameMode}
        />
      )}
      {currentPage === 'random' && currentGameMode === 'episode_ladder' && (
        <RandomEpisodeLadderPage key={`random-ladder:${user?.id ?? 'guest'}`} onNavigate={onNavigate}
          onOpenGame={onOpenGame} onOpenHistory={onOpenHistory} onOpenRandomGame={onOpenRandomGame}
          onStartCheckout={handleStartCheckout} premiumAccess={premiumAccess} />
      )}
      {currentPage === 'random' && currentGameMode !== 'episode_ladder' && (
        <RandomGamePage
          accessToken={session?.access_token ?? null}
          currentStreak={currentStreak}
          isAuthenticated={isAuthenticated}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          onOpenRandomGame={onOpenRandomGame}
          onStreakUpdated={handleStreakUpdated}
          onStartCheckout={handleStartCheckout}
          premiumAccess={premiumAccess}
          selectedGameMode={currentGameMode}
        />
      )}
      {currentPage === 'history' && (
        <PreviousGamesPage
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          premiumAccess={premiumAccess}
          isPremiumLoading={isPremiumLoading || isLoading}
          selectedGameMode={currentGameMode}
        />
      )}
      {currentPage === 'leaderboard' && <LeaderboardPage />}
      {currentPage === 'premium' && (
        <PremiumPage
          isAuthenticated={isAuthenticated}
          isPremiumLoading={isPremiumLoading}
          onAuthNavigate={onAuthNavigate}
          onNavigate={onNavigate}
          onOpenBillingPortal={handleOpenBillingPortal}
          onStartCheckout={handleStartCheckout}
          premiumAccess={premiumAccess}
        />
      )}
      {currentPage === 'profile' && (
        <ProfilePage
          billingRedirectStatus={billingRedirectStatus}
          isProfileLoading={isProfileLoading}
          onAuthNavigate={onAuthNavigate}
          onNavigate={onNavigate}
          isPremiumUser={showSupporterBadge}
          profile={resolvedProfile}
          profileError={profileError}
          showSupporterBadge={showSupporterBadge}
        />
      )}
      {currentPage === 'support' && <SupportPage onNavigate={onNavigate} />}
      {currentPage === 'updates' && <UpdatesPage key={currentPostSlug ?? 'list'} slug={currentPostSlug}
        token={session?.access_token ?? null} userId={user?.id} onLogin={() => onAuthNavigate('login')} />}
      {currentPage === 'admin' && <AdminPage key={user?.id ?? 'guest'} token={session?.access_token ?? null} onLogin={() => onAuthNavigate('login')} />}
      {currentPage === 'about' && <AboutPage onNavigate={onNavigate} />}
      {currentPage === 'howToPlay' && <HowToPlayPage onNavigate={onNavigate} />}
      {currentPage === 'privacyPolicy' && <LegalDocumentPage onNavigate={onNavigate} page="privacyPolicy" />}
      {currentPage === 'termsOfService' && <LegalDocumentPage onNavigate={onNavigate} page="termsOfService" />}
      </ArchiveRouteGuard>
      </DeferredContent>
      <SiteFooter onNavigate={onNavigate} />
      {announcements.post && !billingRedirectStatus && (currentPage !== 'landing' || (!window.location.hash && !window.location.search)) && !['game', 'random', 'auth', 'admin', 'updates', 'premium'].includes(currentPage) && (
        <AnnouncementPopup key={`${user?.id ?? 'guest'}:${announcements.post.id}`} post={announcements.post}
          unread={announcements.unread} token={session?.access_token ?? null} userId={user?.id} onSeen={announcements.markSeen} onLogin={() => onAuthNavigate('login')} />
      )}
    </div>
  );
}
