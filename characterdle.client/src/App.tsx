import { useEffect, useRef, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { ArchiveRouteGuard } from './components/layout/ArchiveRouteGuard';
import { SeoManager } from './components/seo/SeoManager';
import { useUniverse } from './hooks/useUniverse';
import { useAuth } from './hooks/useAuth';
import { useAnnouncements } from './hooks/useAnnouncements';
import { LatestUpdatePopup } from './components/updates/LatestUpdatePopup';
import { buildRoutePath, isUniverseScopedPage } from './lib/routePaths';
import { getDefaultRoute, readRouteFromSegments } from './lib/routeParser';
import { LandingPage } from './pages/LandingPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import { routeForPath } from './seo/publicRoutes';
import type { GameMode } from './types/game';
import type { AppRoute, AuthMode, Page } from './types/routes';


function readLegacyHashRoute(hash: string): AppRoute | null {
  const normalizedHash = hash.replace(/^#\/?/, '').trim();

  if (!normalizedHash) {
    return null;
  }

  return readRouteFromSegments(normalizedHash.split('/'));
}

function readRouteFromLocation(): AppRoute {
  if (typeof window === 'undefined') {
    return getDefaultRoute();
  }

  const legacyHashRoute = readLegacyHashRoute(window.location.hash);

  if (legacyHashRoute) {
    return legacyHashRoute;
  }

  if (window.location.pathname === '/') {
    return getDefaultRoute();
  }

  return routeForPath(window.location.pathname) ?? {
    ...getDefaultRoute(), page: 'notFound', requestedPath: window.location.pathname, universeId: null,
  };
}

function App() {
  const [isLatestUpdateOpen, setLatestUpdateOpen] = useState(false);
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromLocation());
  const acceptedLocation = useRef(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  const { session, user, isLoading, isAuthenticated } = useAuth();
  const announcements = useAnnouncements(session?.access_token ?? null, user?.id, isLoading);
  const { selectedUniverseId, setSelectedUniverseId } = useUniverse();

  useEffect(() => {
    if (!route.universeId || route.universeId === selectedUniverseId) {
      return;
    }

    setSelectedUniverseId(route.universeId);
  }, [route.universeId, selectedUniverseId, setSelectedUniverseId]);

  useEffect(() => {
    function syncRouteFromLocation(event?: PopStateEvent) {
      if (event && !window.dispatchEvent(new Event('characterdle:before-navigate', { cancelable: true }))) {
        window.history.pushState(null, '', acceptedLocation.current);
        return;
      }
      const nextRoute = readRouteFromLocation();
      setRoute(nextRoute);

      const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;
      const canonicalPathAndSearch = `${buildRoutePath(nextRoute)}${window.location.search}`;

      if (readLegacyHashRoute(window.location.hash) || currentPathAndSearch !== canonicalPathAndSearch) {
        const hash = readLegacyHashRoute(window.location.hash) ? '' : window.location.hash;
        window.history.replaceState(null, '', `${canonicalPathAndSearch}${hash}`);
      }
      acceptedLocation.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    }

    syncRouteFromLocation();

    window.addEventListener('popstate', syncRouteFromLocation);

    return () => {
      window.removeEventListener('popstate', syncRouteFromLocation);
    };
  }, []);

  function navigateToRoute(nextRoute: AppRoute) {
    if (!window.dispatchEvent(new Event('characterdle:before-navigate', { cancelable: true }))) return;
    setRoute(nextRoute);

    const nextUrl = buildRoutePath(nextRoute);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl === nextUrl) {
      return;
    }

    window.history.pushState(null, '', nextUrl);
    acceptedLocation.current = nextUrl;
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
    if (page === 'updates') { setLatestUpdateOpen(true); return; }
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

  const latestUpdatePopup = isLatestUpdateOpen && <LatestUpdatePopup key={user?.id ?? 'guest'}
    token={session?.access_token ?? null} userId={user?.id} onSeen={announcements.markSeen}
    onClose={() => setLatestUpdateOpen(false)} onLogin={() => { setLatestUpdateOpen(false); openAuth('login'); }} />;

  if (route.page === 'notFound') return <><SeoManager route={route} /><RouteErrorPage /></>;

  if (route.page === 'landing' && (isLoading || !isAuthenticated)) {
    return (
      <>
        <SeoManager route={route} />
        <LandingPage isAuthLoading={isLoading} onNavigate={handleNavigate} onAuthNavigate={openAuth} />
        {latestUpdatePopup}
      </>
    );
  }

  const content = (
    <>
      <SeoManager route={route} />
      {latestUpdatePopup}
      <AppShell
        announcements={announcements}
        currentPostSlug={route.postSlug}
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
  return route.page === 'game' && route.gameId !== null
    ? <ArchiveRouteGuard key={buildRoutePath(route)} route={route}>{content}</ArchiveRouteGuard>
    : content;
}

export default App;
