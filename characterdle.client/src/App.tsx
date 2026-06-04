import { useEffect, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import type { GameMode } from './types/game';
import type { AuthMode, Page } from './types/routes';

interface AppRoute {
  authMode: AuthMode;
  gameId: number | null;
  gameMode: GameMode;
  page: Page;
}

const defaultRoute: AppRoute = {
  authMode: 'login',
  gameId: null,
  gameMode: 'character',
  page: 'landing',
};

function parseGameMode(value: string | undefined): GameMode | null {
  return value === 'quote' || value === 'character'
    ? value
    : null;
}

function parseGameId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsedGameId = Number(value);

  return Number.isInteger(parsedGameId) && parsedGameId > 0
    ? parsedGameId
    : null;
}

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
      gameMode: 'character',
      page: 'auth',
    };
  }

  if (pageSegment === 'game') {
    const parsedMode = parseGameMode(modeSegment);

    return {
      authMode: 'login',
      gameId: parsedMode
        ? parseGameId(normalizedHash.split('/')[2])
        : parseGameId(modeSegment),
      gameMode: parsedMode ?? 'character',
      page: 'game',
    };
  }

  if (pageSegment === 'history') {
    return {
      authMode: 'login',
      gameId: null,
      gameMode: parseGameMode(modeSegment) ?? 'character',
      page: 'history',
    };
  }

  const validPages: Page[] = ['landing', 'launcher', 'game', 'history', 'leaderboard', 'profile'];

  return validPages.includes(pageSegment as Page)
    ? { authMode: 'login', gameId: null, gameMode: 'character', page: pageSegment as Page }
    : defaultRoute;
}

function buildHash(route: AppRoute): string {
  return route.page === 'auth'
    ? `#/auth/${route.authMode}`
    : route.page === 'game' && route.gameId !== null
      ? `#/game/${route.gameMode}/${route.gameId}`
      : route.page === 'game'
        ? `#/game/${route.gameMode}`
        : route.page === 'history'
          ? `#/history/${route.gameMode}`
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
      gameMode: route.gameMode,
      page,
    });
  }

  function openAuth(mode: AuthMode) {
    navigateToRoute({
      authMode: mode,
      gameId: null,
      gameMode: route.gameMode,
      page: 'auth',
    });
  }

  function openGame(gameMode: GameMode, gameId: number | null) {
    navigateToRoute({
      authMode: route.authMode,
      gameId,
      gameMode,
      page: 'game',
    });
  }

  function openHistory(gameMode: GameMode) {
    navigateToRoute({
      authMode: route.authMode,
      gameId: null,
      gameMode,
      page: 'history',
    });
  }

  if (route.page === 'landing') {
    return <LandingPage onNavigate={handleNavigate} onAuthNavigate={openAuth} />;
  }

  return (
    <AppShell
      authMode={route.authMode}
      currentGameId={route.gameId}
      currentGameMode={route.gameMode}
      currentPage={route.page}
      onAuthNavigate={openAuth}
      onNavigate={handleNavigate}
      onOpenGame={openGame}
      onOpenHistory={openHistory}
    />
  );
}

export default App;
