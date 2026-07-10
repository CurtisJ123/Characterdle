import { useEffect, useState } from 'react';
import { AdSenseBootstrap } from './AdSenseBootstrap';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import { usePremium } from '../../hooks/usePremium';
import { useProfile } from '../../hooks/useProfile';
import { useUniverse } from '../../hooks/useUniverse';
import { createBillingCheckoutSession, createBillingPortalSession } from '../../services/billingApi';
import {
  cacheUniverseGameResults,
  getGameProgressOwnerKey,
  syncPersistedGameResultsToLocalProgress,
} from '../../lib/characterGameProgress';
import { AuthPage } from '../../pages/AuthPage';
import { AboutPage } from '../../pages/AboutPage';
import { CharacterGamePage } from '../../pages/CharacterGamePage';
import { HowToPlayPage } from '../../pages/HowToPlayPage';
import { LauncherPage } from '../../pages/LauncherPage';
import { LeaderboardPage } from '../../pages/LeaderboardPage';
import { LegalDocumentPage } from '../../pages/LegalDocumentPage';
import { PreviousGamesPage } from '../../pages/PreviousGamesPage';
import { PremiumPage } from '../../pages/PremiumPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { RandomGamePage } from '../../pages/RandomGamePage';
import { SupportPage } from '../../pages/SupportPage';
import { getGameResults } from '../../services/profileApi';
import type { AccountSettingsValues } from '../../types/auth';
import type { BillingCheckoutPlan } from '../../types/billing';
import type { GameMode } from '../../types/game';
import type { UniverseStreak } from '../../types/leaderboard';
import type { PremiumAccess } from '../../types/premium';
import type { UniverseProfile } from '../../types/profile';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';

interface LiveStreakState {
  scope: string;
  streak: UniverseStreak;
}

type BillingRedirectStatus = 'success' | 'cancelled' | null;

interface AppShellProps {
  authMode: AuthMode;
  currentPage: Exclude<Page, 'landing'>;
  currentGameId: number | null;
  currentGameMode: GameMode;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
  onOpenRandomGame: (gameMode: GameMode, universeId?: string) => void;
}

export function AppShell({
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
  } = useProfile(session?.access_token ?? null, selectedUniverse.id);
  const {
    data: premiumData,
    isLoading: isPremiumLoading,
    reload: reloadPremium,
  } = usePremium(session?.access_token ?? null);
  const [liveStreak, setLiveStreak] = useState<LiveStreakState | null>(null);
  const streakScope = `${user?.id ?? 'guest'}:${selectedUniverse.id}`;
  const liveStreakForScope = liveStreak?.scope === streakScope
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
  const isPremiumActive = premiumAccess?.isPremium === true;
  const showSupporterBadge = premiumAccess?.supporterBadge === true;
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

  function handleStreakUpdated(streak: UniverseStreak) {
    setLiveStreak({
      scope: streakScope,
      streak,
    });
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
      <AdSenseBootstrap
        isAdFreePremium={premiumAccess?.adFree === true}
        isAuthenticated={isAuthenticated}
        isAuthLoading={isLoading}
        isPremiumLoading={isPremiumLoading}
      />
      <SiteHeader
        isPremiumActive={isPremiumActive}
        isPremiumUser={showSupporterBadge}
        isPremiumLoading={isPremiumLoading}
        autoUseStreakSavers={premiumAccess?.autoUseStreakSavers ?? true}
        availableStreakSavers={premiumAccess?.availableStreakSavers ?? 0}
        currentPage={currentPage}
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
          isUserLoading={isLoading}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          user={user}
        />
      )}
      {currentPage === 'game' && (
        <CharacterGamePage
          key={user?.id ?? 'guest'}
          premiumAccess={premiumAccess}
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
      {currentPage === 'random' && (
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
      {currentPage === 'about' && <AboutPage onNavigate={onNavigate} />}
      {currentPage === 'howToPlay' && <HowToPlayPage onNavigate={onNavigate} />}
      {currentPage === 'privacyPolicy' && <LegalDocumentPage onNavigate={onNavigate} page="privacyPolicy" />}
      {currentPage === 'termsOfService' && <LegalDocumentPage onNavigate={onNavigate} page="termsOfService" />}
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
