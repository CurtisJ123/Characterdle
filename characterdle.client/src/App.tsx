import { useEffect, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { SeoManager } from './components/seo/SeoManager';
import { defaultUniverseId } from './data/universeCatalog';
import { useUniverse } from './hooks/useUniverse';
import { buildRoutePath, isUniverseScopedPage } from './lib/routePaths';
import { getUniverseIdFromPathname, getUniverseSubdomainUniverseId } from './lib/siteRouting';
import { LandingPage } from './pages/LandingPage';
import type { GameMode } from './types/game';
import type { AppRoute, AuthMode, Page } from './types/routes';

const mainSiteDefaultRoute: AppRoute = {
  authMode: 'login',
  gameId: null,
  gameMode: 'character',
  page: 'landing',
  universeId: null,
};

function applyUniverseScope(
  route: Omit<AppRoute, 'universeId'>,
  explicitUniverseId: string | null,
): AppRoute {
  return {
    ...route,
    universeId: explicitUniverseId ?? (isUniverseScopedPage(route.page) ? defaultUniverseId : null),
  };
}

function createUniverseGameRoute(universeId: string): AppRoute {
  return {
    authMode: 'login',
    gameId: null,
    gameMode: 'character',
    page: 'game',
    universeId,
  };
}

function getDefaultRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return mainSiteDefaultRoute;
  }

  const subdomainUniverseId = getUniverseSubdomainUniverseId(window.location.hostname);

  return subdomainUniverseId
    ? createUniverseGameRoute(subdomainUniverseId)
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

function buildAuthRoute(authMode: AuthMode, universeId: string | null): AppRoute {
  return applyUniverseScope({
    authMode,
    gameId: null,
    gameMode: 'character',
    page: 'auth',
  }, universeId);
}

function parseUniverseSegment(value: string | undefined): string | null {
  return value
    ? getUniverseIdFromPathname(`/${value}`)
    : null;
}

function readRouteFromSegments(segments: string[]): AppRoute | null {
  const explicitUniverseId = parseUniverseSegment(segments[0]);
  const routeSegments = explicitUniverseId
    ? segments.slice(1)
    : segments;
  const [pageSegment, modeSegment, gameIdSegment] = routeSegments;

  if (!pageSegment) {
    return explicitUniverseId
      ? createUniverseGameRoute(explicitUniverseId)
      : null;
  }

  switch (pageSegment) {
    case 'landing':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'landing',
      }, explicitUniverseId);
    case 'home':
    case 'launcher':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'launcher',
      }, explicitUniverseId);
    case 'login':
      return buildAuthRoute('login', explicitUniverseId);
    case 'signup':
      return buildAuthRoute('signup', explicitUniverseId);
    case 'forgot-password':
      return buildAuthRoute('forgotPassword', explicitUniverseId);
    case 'reset-password':
      return buildAuthRoute('resetPassword', explicitUniverseId);
    case 'auth':
      return buildAuthRoute(parseAuthMode(modeSegment), explicitUniverseId);
    case 'game': {
      const parsedMode = parseGameMode(modeSegment);

      return applyUniverseScope({
        authMode: 'login',
        gameId: parsedMode
          ? parseGameId(gameIdSegment)
          : parseGameId(modeSegment),
        gameMode: parsedMode ?? 'character',
        page: 'game',
      }, explicitUniverseId);
    }
    case 'random':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: parseGameMode(modeSegment) ?? 'character',
        page: 'random',
      }, explicitUniverseId);
    case 'archive':
    case 'history':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: parseGameMode(modeSegment) ?? 'character',
        page: 'history',
      }, explicitUniverseId);
    case 'leaderboard':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'leaderboard',
      }, explicitUniverseId);
    case 'premium':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'premium',
      }, explicitUniverseId);
    case 'profile':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'profile',
      }, explicitUniverseId);
    case 'support':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'support',
      }, explicitUniverseId);
    case 'about':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'about',
      }, explicitUniverseId);
    case 'how-to-play':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'howToPlay',
      }, explicitUniverseId);
    case 'privacy-policy':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'privacyPolicy',
      }, explicitUniverseId);
    case 'terms':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'termsOfService',
      }, explicitUniverseId);
    case 'subscription-cancellation':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'termsOfService',
      }, explicitUniverseId);
    case 'refund-policy':
      return applyUniverseScope({
        authMode: 'login',
        gameId: null,
        gameMode: 'character',
        page: 'termsOfService',
      }, explicitUniverseId);
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

function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromLocation());
  const { selectedUniverseId, setSelectedUniverseId } = useUniverse();

  useEffect(() => {
    if (!route.universeId || route.universeId === selectedUniverseId) {
      return;
    }

    setSelectedUniverseId(route.universeId);
  }, [route.universeId, selectedUniverseId, setSelectedUniverseId]);

  useEffect(() => {
    function syncRouteFromLocation() {
      const nextRoute = readRouteFromLocation();
      setRoute(nextRoute);

      const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
      const canonicalPathAndSearch = `${buildRoutePath(nextRoute)}${window.location.search}`;

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

    const nextUrl = buildRoutePath(nextRoute);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl === nextUrl) {
      return;
    }

    window.history.pushState(null, '', nextUrl);
  }

  function getScopedUniverseId(nextPage: Page): string | null {
    if (route.universeId && (isUniverseScopedPage(nextPage) || nextPage === 'auth')) {
      return route.universeId;
    }

    return isUniverseScopedPage(nextPage)
      ? selectedUniverseId
      : null;
  }

  function handleNavigate(page: Page) {
    navigateToRoute({
      authMode: route.authMode,
      gameId: null,
      gameMode: route.gameMode,
      page,
      universeId: page === 'launcher'
        ? route.universeId
        : getScopedUniverseId(page),
    });
  }

  function openAuth(mode: AuthMode) {
    navigateToRoute({
      authMode: mode,
      gameId: null,
      gameMode: route.gameMode,
      page: 'auth',
      universeId: route.universeId,
    });
  }

  function openGame(gameMode: GameMode, gameId: number | null, universeId?: string) {
    navigateToRoute({
      authMode: route.authMode,
      gameId,
      gameMode,
      page: 'game',
      universeId: universeId ?? route.universeId ?? selectedUniverseId,
    });
  }

  function openHistory(gameMode: GameMode, universeId?: string) {
    navigateToRoute({
      authMode: route.authMode,
      gameId: null,
      gameMode,
      page: 'history',
      universeId: universeId ?? route.universeId ?? selectedUniverseId,
    });
  }

  function openRandomGame(gameMode: GameMode, universeId?: string) {
    navigateToRoute({
      authMode: route.authMode,
      gameId: null,
      gameMode,
      page: 'random',
      universeId: universeId ?? route.universeId ?? selectedUniverseId,
    });
  }

  if (route.page === 'landing') {
    return (
      <>
        <SeoManager route={route} />
        <LandingPage onNavigate={handleNavigate} onAuthNavigate={openAuth} />
      </>
    );
  }

  return (
    <>
      <SeoManager route={route} />
      <AppShell
        authMode={route.authMode}
        currentGameId={route.gameId}
        currentGameMode={route.gameMode}
        currentPage={route.page}
        onAuthNavigate={openAuth}
        onNavigate={handleNavigate}
        onOpenGame={openGame}
        onOpenHistory={openHistory}
        onOpenRandomGame={openRandomGame}
      />
    </>
  );
}

export default App;
