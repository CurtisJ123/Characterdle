import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useAuth } from '../../hooks/useAuth';
import { AuthPage } from '../../pages/AuthPage';
import { CharacterGamePage } from '../../pages/CharacterGamePage';
import { LauncherPage } from '../../pages/LauncherPage';
import { LeaderboardPage } from '../../pages/LeaderboardPage';
import { QuoteGamePage } from '../../pages/QuoteGamePage';
import { StatsPage } from '../../pages/StatsPage';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';

interface AppShellProps {
  authMode: AuthMode;
  currentPage: Exclude<Page, 'landing'>;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

export function AppShell({ authMode, currentPage, onAuthNavigate, onNavigate }: AppShellProps) {
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
      {currentPage === 'game' && <CharacterGamePage onNavigate={onNavigate} />}
      {currentPage === 'quote' && <QuoteGamePage onNavigate={onNavigate} />}
      {currentPage === 'leaderboard' && <LeaderboardPage />}
      {currentPage === 'stats' && <StatsPage onNavigate={onNavigate} />}
      <SiteFooter />
    </div>
  );
}
