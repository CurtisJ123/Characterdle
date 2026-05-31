import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import { AuthPage } from '../../pages/AuthPage';
import { CharacterGamePage } from '../../pages/CharacterGamePage';
import { LauncherPage } from '../../pages/LauncherPage';
import { LeaderboardPage } from '../../pages/LeaderboardPage';
import { PreviousGamesPage } from '../../pages/PreviousGamesPage';
import { QuoteGamePage } from '../../pages/QuoteGamePage';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';

interface AppShellProps {
  authMode: AuthMode;
  currentPage: Exclude<Page, 'landing'>;
  currentGameId: number | null;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onOpenGame: (gameId: number | null) => void;
}

export function AppShell({
  authMode,
  currentGameId,
  currentPage,
  onAuthNavigate,
  onNavigate,
  onOpenGame,
}: AppShellProps) {
  const { authError, isAuthenticated, isLoading, signOut, user } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
      onAuthNavigate('login');
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader
        currentPage={currentPage}
        isAuthenticated={isAuthenticated}
        isUserLoading={isLoading}
        onAuthNavigate={onAuthNavigate}
        onNavigate={onNavigate}
        onSignOut={handleSignOut}
        userDisplayName={user?.displayName}
      />
      {currentPage === 'auth' && <AuthPage initialMode={authMode} onNavigate={onNavigate} />}
      {currentPage === 'launcher' && (
        <LauncherPage authError={authError} isUserLoading={isLoading} onNavigate={onNavigate} user={user} />
      )}
      {currentPage === 'game' && <CharacterGamePage onNavigate={onNavigate} selectedGameId={currentGameId} />}
      {currentPage === 'quote' && <QuoteGamePage onNavigate={onNavigate} />}
      {currentPage === 'history' && <PreviousGamesPage onNavigate={onNavigate} onOpenGame={onOpenGame} />}
      {currentPage === 'leaderboard' && <LeaderboardPage />}
      <SiteFooter />
    </div>
  );
}
