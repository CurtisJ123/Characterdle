import { useState } from 'react';
import './App.css';
import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { AuthPage } from './pages/AuthPage';
import { CharacterGamePage } from './pages/CharacterGamePage';
import { LandingPage } from './pages/LandingPage';
import { LauncherPage } from './pages/LauncherPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { QuoteGamePage } from './pages/QuoteGamePage';
import { StatsPage } from './pages/StatsPage';
import type { AuthMode, Page } from './types/routes';

function App() {
  const [page, setPage] = useState<Page>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setPage('auth');
  }

  if (page === 'landing') {
    return <LandingPage onNavigate={setPage} onAuthNavigate={openAuth} />;
  }

  return (
    <div className="app-shell">
      <SiteHeader currentPage={page} onAuthNavigate={openAuth} onNavigate={setPage} />
      {page === 'auth' && <AuthPage initialMode={authMode} onNavigate={setPage} />}
      {page === 'launcher' && <LauncherPage onNavigate={setPage} />}
      {page === 'game' && <CharacterGamePage onNavigate={setPage} />}
      {page === 'quote' && <QuoteGamePage onNavigate={setPage} />}
      {page === 'leaderboard' && <LeaderboardPage />}
      {page === 'stats' && <StatsPage onNavigate={setPage} />}
      <SiteFooter />
    </div>
  );
}

export default App;
