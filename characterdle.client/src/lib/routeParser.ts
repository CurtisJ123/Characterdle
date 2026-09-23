import { defaultUniverseId } from '../data/universeCatalog';
import { isUniverseScopedPage } from './routePaths';
import { getUniverseIdFromPathname, getUniverseSubdomainUniverseId } from './siteRouting';
import type { GameMode } from '../types/game';
import type { AppRoute, AuthMode } from '../types/routes';

export const mainSiteDefaultRoute: AppRoute = {
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

export function getDefaultRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return mainSiteDefaultRoute;
  }

  const subdomainUniverseId = getUniverseSubdomainUniverseId(window.location.hostname);

  return subdomainUniverseId
    ? createUniverseGameRoute(subdomainUniverseId)
    : mainSiteDefaultRoute;
}

function parseGameMode(value: string | undefined): GameMode | null {
  return value === 'quote' || value === 'character' || value === 'episode_ladder'
    ? value
    : null;
}

function parseGameId(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsedGameId = Number(value);

  return /^\d+$/.test(value) && Number.isSafeInteger(parsedGameId) && parsedGameId > 0
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

export function readRouteFromSegments(segments: string[]): AppRoute | null {
  const explicitUniverseId = parseUniverseSegment(segments[0]);
  const routeSegments = explicitUniverseId
    ? segments.slice(1)
    : segments;
  const [pageSegment, modeSegment, gameIdSegment] = routeSegments;

  // Never discard an unknown tail, mode, or invalid ID and turn it into a real page.
  const maxSegments = pageSegment === 'game' ? 3
    : ['updates', 'auth', 'random', 'archive', 'history'].includes(pageSegment) ? 2 : 1;
  if (routeSegments.length > maxSegments || routeSegments.some(segment => !segment)) return null;
  if (pageSegment === 'updates' && modeSegment && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(modeSegment)) return null;
  if (pageSegment === 'auth' && modeSegment
    && !['login', 'signup', 'forgot-password', 'reset-password'].includes(modeSegment)) return null;
  if (['random', 'archive', 'history'].includes(pageSegment) && modeSegment && !parseGameMode(modeSegment)) return null;

  if (!pageSegment) {
    return explicitUniverseId
      ? createUniverseGameRoute(explicitUniverseId)
      : null;
  }

  switch (pageSegment) {
    case 'updates':
      return { authMode: 'login', gameId: null, gameMode: 'character', page: 'updates', universeId: null,
        postSlug: modeSegment };
    case 'admin':
      return { authMode: 'login', gameId: null, gameMode: 'character', page: 'admin', universeId: null };
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
      const idSegment = parsedMode ? gameIdSegment : modeSegment;
      if ((!parsedMode && gameIdSegment) || (idSegment !== undefined && parseGameId(idSegment) === null)) return null;

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
