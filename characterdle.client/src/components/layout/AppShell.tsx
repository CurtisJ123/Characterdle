import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import { AuthPage } from '../../pages/AuthPage';
import { CharacterGamePage } from '../../pages/CharacterGamePage';
import { LauncherPage } from '../../pages/LauncherPage';
import { LeaderboardPage } from '../../pages/LeaderboardPage';
import { PreviousGamesPage } from '../../pages/PreviousGamesPage';
import { ProfilePage } from '../../pages/ProfilePage';
import type { GameMode } from '../../types/game';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';

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
  const { authError, isAuthenticated, isLoading, signOut, updateAccount, user } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
      onAuthNavigate('login');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveDisplayName(displayName: string) {
    const result = await updateAccount({ displayName });
    return result.message;
  }

  return (
    <div className="app-shell">
      <SiteHeader
        currentPage={currentPage}
        isAuthenticated={isAuthenticated}
        isUserLoading={isLoading}
        onAuthNavigate={onAuthNavigate}
        onNavigate={onNavigate}
        onSaveDisplayName={handleSaveDisplayName}
        onSignOut={handleSignOut}
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
          onNavigate={onNavigate}
          onOpenGame={onOpenGame}
          onOpenHistory={onOpenHistory}
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
      {currentPage === 'profile' && <ProfilePage onAuthNavigate={onAuthNavigate} onNavigate={onNavigate} />}
      <SiteFooter />
    </div>
  );
}
