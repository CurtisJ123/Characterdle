import { useState } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useUniverse } from '../../hooks/useUniverse';
import { AuthPage } from '../../pages/AuthPage';
import { CharacterGamePage } from '../../pages/CharacterGamePage';
import { LauncherPage } from '../../pages/LauncherPage';
import { LeaderboardPage } from '../../pages/LeaderboardPage';
import { PreviousGamesPage } from '../../pages/PreviousGamesPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { SupportPage } from '../../pages/SupportPage';
import type { GameMode } from '../../types/game';
import type { UniverseStreak } from '../../types/leaderboard';
import type { UniverseProfile } from '../../types/profile';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';

interface LiveStreakState {
  scope: string;
  streak: UniverseStreak;
}

interface AppShellProps {
  authMode: AuthMode;
  currentPage: Exclude<Page, 'landing'>;
  currentGameId: number | null;
  currentGameMode: GameMode;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
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
  const [liveStreak, setLiveStreak] = useState<LiveStreakState | null>(null);
  const streakScope = `${user?.id ?? 'guest'}:${selectedUniverse.id}`;
  const liveStreakForScope = liveStreak?.scope === streakScope
    ? liveStreak.streak
    : null;
  const resolvedProfile: UniverseProfile | null = profile
    ? {
      ...profile,
      currentStreak: liveStreakForScope?.currentStreak ?? profile.currentStreak,
      longestStreak: liveStreakForScope?.longestStreak ?? profile.longestStreak,
    }
    : null;
  const currentStreak = liveStreakForScope?.currentStreak ?? resolvedProfile?.currentStreak ?? 0;

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

  async function handleSaveSettings(values: { displayName: string; avatarUrl: string | null }) {
    const result = await updateAccount(values);
    await reloadProfile();
    return result.message;
  }

  async function handleDeleteAccount() {
    const result = await deleteAccount();
    setLiveStreak(null);
    onNavigate('launcher');
    return result.message;
  }

  return (
    <div className="app-shell">
      <SiteHeader
        currentPage={currentPage}
        isAuthenticated={isAuthenticated}
        isUserLoading={isLoading}
        onAuthNavigate={onAuthNavigate}
        onDeleteAccount={handleDeleteAccount}
        onLoadAccountDeletionStatus={getAccountDeletionStatus}
        onNavigate={onNavigate}
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
          authError={authError}
          isUserLoading={isLoading}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          user={user}
        />
      )}
      {currentPage === 'game' && (
        <CharacterGamePage
          key={user?.id ?? 'guest'}
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          currentStreak={currentStreak}
          onStreakUpdated={handleStreakUpdated}
          selectedGameId={currentGameId}
          selectedGameMode={currentGameMode}
        />
      )}
      {currentPage === 'history' && (
        <PreviousGamesPage
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
          selectedGameMode={currentGameMode}
        />
      )}
      {currentPage === 'leaderboard' && <LeaderboardPage />}
      {currentPage === 'profile' && (
        <ProfilePage
          isProfileLoading={isProfileLoading}
          onAuthNavigate={onAuthNavigate}
          onNavigate={onNavigate}
          profile={resolvedProfile}
          profileError={profileError}
        />
      )}
      {currentPage === 'support' && <SupportPage onNavigate={onNavigate} />}
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
