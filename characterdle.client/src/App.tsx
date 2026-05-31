import { useEffect, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import type { AuthMode, Page } from './types/routes';

interface AppRoute {
  authMode: AuthMode;
  gameId: number | null;
  page: Page;
}

const defaultRoute: AppRoute = {
  authMode: 'login',
  gameId: null,
  page: 'landing',
};

function readRouteFromHash(): AppRoute {
  if (typeof window === 'undefined') {
    return defaultRoute;
  }

  const normalizedHash = window.location.hash.replace(/^#\/?/, '').trim();

  if (!normalizedHash) {
    return defaultRoute;
  }

  const [pageSegment, modeSegment] = normalizedHash.split('/');

  if (pageSegment === 'auth') {
    return {
      authMode: modeSegment === 'signup' ? 'signup' : 'login',
      gameId: null,
      page: 'auth',
    };
  }

  if (pageSegment === 'game') {
    const parsedGameId = modeSegment ? Number(modeSegment) : null;

    return {
      authMode: 'login',
      gameId: typeof parsedGameId === 'number' && Number.isInteger(parsedGameId) && parsedGameId > 0
        ? parsedGameId
        : null,
      page: 'game',
    };
  }

  const validPages: Page[] = ['landing', 'launcher', 'game', 'quote', 'history', 'leaderboard'];

  return validPages.includes(pageSegment as Page)
    ? { authMode: 'login', gameId: null, page: pageSegment as Page }
    : defaultRoute;
}

function buildHash(route: AppRoute): string {
  return route.page === 'auth'
    ? `#/auth/${route.authMode}`
    : route.page === 'game' && route.gameId !== null
      ? `#/game/${route.gameId}`
      : `#/${route.page}`;
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromHash());

  useEffect(() => {
    function syncRouteFromHash() {
      setRoute(readRouteFromHash());
    }

    if (!window.location.hash) {
      window.history.replaceState(null, '', buildHash(defaultRoute));
    } else {
      syncRouteFromHash();
    }

    window.addEventListener('hashchange', syncRouteFromHash);

    return () => {
      window.removeEventListener('hashchange', syncRouteFromHash);
    };
  }, []);

  function navigateToRoute(nextRoute: AppRoute) {
    setRoute(nextRoute);

    const nextHash = buildHash(nextRoute);

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function handleNavigate(page: Page) {
    navigateToRoute({
      authMode: route.authMode,
      gameId: null,
      page,
    });
  }

  function openAuth(mode: AuthMode) {
    navigateToRoute({
      authMode: mode,
      gameId: null,
      page: 'auth',
    });
  }

  function openGame(gameId: number | null) {
    navigateToRoute({
      authMode: route.authMode,
      gameId,
      page: 'game',
    });
  }

  if (route.page === 'landing') {
    return <LandingPage onNavigate={handleNavigate} onAuthNavigate={openAuth} />;
  }

  return (
    <AppShell
      authMode={route.authMode}
      currentGameId={route.gameId}
      currentPage={route.page}
      onAuthNavigate={openAuth}
      onNavigate={handleNavigate}
      onOpenGame={openGame}
    />
  );
}

export default App;
