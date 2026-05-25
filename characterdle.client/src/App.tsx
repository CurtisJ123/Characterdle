import { useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
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
    <AppShell authMode={authMode} currentPage={page} onAuthNavigate={openAuth} onNavigate={setPage} />
  );
}

export default App;
