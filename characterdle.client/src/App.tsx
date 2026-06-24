import { useEffect, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { getUniverseSubdomainUniverseId } from './lib/siteRouting';
import { LandingPage } from './pages/LandingPage';
import type { GameMode } from './types/game';
import type { AuthMode, Page } from './types/routes';

interface AppRoute {
  authMode: AuthMode;
  gameId: number | null;
  gameMode: GameMode;
  page: Page;
}

const mainSiteDefaultRoute: AppRoute = {
  authMode: 'login',
  gameId: null,
  gameMode: 'character',
  page: 'landing',
};

function getDefaultRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return mainSiteDefaultRoute;
  }

  return getUniverseSubdomainUniverseId(window.location.hostname)
    ? {
      authMode: 'login',
      gameId: null,
      gameMode: 'character',
      page: 'game',
    }
    : mainSiteDefaultRoute;
}

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

function parseAuthMode(value: string | undefined): AuthMode {
  return value === 'signup'
    ? 'signup'
    : value === 'forgot-password'
      ? 'forgotPassword'
      : value === 'reset-password'
        ? 'resetPassword'
        : 'login';
}

function buildAuthRoute(authMode: AuthMode): AppRoute {
  return {
    authMode,
    gameId: null,
    gameMode: 'character',
    page: 'auth',
  };
}

function readRouteFromSegments(segments: string[]): AppRoute | null {
  const [pageSegment, modeSegment, gameIdSegment] = segments;

  switch (pageSegment) {
    case 'landing':
      return {
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'landing',
      };
    case 'home':
    case 'launcher':
      return {
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'launcher',
      };
    case 'login':
      return buildAuthRoute('login');
    case 'signup':
      return buildAuthRoute('signup');
    case 'forgot-password':
      return buildAuthRoute('forgotPassword');
    case 'reset-password':
      return buildAuthRoute('resetPassword');
    case 'auth':
      return buildAuthRoute(parseAuthMode(modeSegment));
    case 'game': {
      const parsedMode = parseGameMode(modeSegment);

      return {
        authMode: 'login',
        gameId: parsedMode
          ? parseGameId(gameIdSegment)
          : parseGameId(modeSegment),
        gameMode: parsedMode ?? 'character',
        page: 'game',
      };
    }
    case 'archive':
    case 'history':
      return {
        authMode: 'login',
        gameId: null,
        gameMode: parseGameMode(modeSegment) ?? 'character',
        page: 'history',
      };
    case 'leaderboard':
      return {
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'leaderboard',
      };
    case 'profile':
      return {
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'profile',
      };
    default:
      return null;
  }
}

function readLegacyHashRoute(hash: string): AppRoute | null {
  const normalizedHash = hash.replace(/^#\/?/, '').trim();

  if (!normalizedHash) {
    return null;
  }

  return readRouteFromSegments(normalizedHash.split('/').filter(Boolean));
}

function readRouteFromLocation(): AppRoute {
  if (typeof window === 'undefined') {
    return getDefaultRoute();
  }

  const legacyHashRoute = readLegacyHashRoute(window.location.hash);

  if (legacyHashRoute) {
    return legacyHashRoute;
  }

  const normalizedPathname = window.location.pathname.replace(/^\/+|\/+$/g, '');

  if (!normalizedPathname) {
    return getDefaultRoute();
  }

  return readRouteFromSegments(normalizedPathname.split('/')) ?? getDefaultRoute();
}

function buildBrowserUrl(route: AppRoute): string {
  if (route.page === 'auth' && route.authMode === 'resetPassword') {
    return '/reset-password';
  }

  const defaultRoute = getDefaultRoute();
  const isDefaultRoute = route.page === defaultRoute.page
    && route.authMode === defaultRoute.authMode
    && route.gameId === defaultRoute.gameId
    && route.gameMode === defaultRoute.gameMode;

  return isDefaultRoute
    ? '/'
    : route.page === 'landing'
      ? '/landing'
      : route.page === 'launcher'
        ? '/home'
        : route.page === 'auth'
          ? route.authMode === 'signup'
            ? '/signup'
            : route.authMode === 'forgotPassword'
              ? '/forgot-password'
              : '/login'
          : route.page === 'game' && route.gameId !== null
            ? `/game/${route.gameMode}/${route.gameId}`
            : route.page === 'game'
              ? `/game/${route.gameMode}`
              : route.page === 'history'
                ? `/archive/${route.gameMode}`
                : `/${route.page}`;
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromLocation());

  useEffect(() => {
    function syncRouteFromLocation() {
      const nextRoute = readRouteFromLocation();
      setRoute(nextRoute);

      const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
      const canonicalPathAndSearch = `${buildBrowserUrl(nextRoute)}${window.location.search}`;

      if (readLegacyHashRoute(window.location.hash) || currentPathAndSearch !== canonicalPathAndSearch) {
        window.history.replaceState(null, '', canonicalPathAndSearch);
      }
    }

    syncRouteFromLocation();

    window.addEventListener('popstate', syncRouteFromLocation);

    return () => {
      window.removeEventListener('popstate', syncRouteFromLocation);
    };
  }, []);

  function navigateToRoute(nextRoute: AppRoute) {
    setRoute(nextRoute);

    const nextUrl = buildBrowserUrl(nextRoute);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl === nextUrl) {
      return;
    }

    window.history.pushState(null, '', nextUrl);
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
