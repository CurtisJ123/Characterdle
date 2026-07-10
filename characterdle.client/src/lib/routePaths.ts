import type { AppRoute, Page } from '../types/routes';

export function isUniverseScopedPage(page: Page): boolean {
  return page === 'game'
    || page === 'random'
    || page === 'history'
    || page === 'leaderboard'
    || page === 'profile';
}

function getUniversePrefix(universeId: string | null): string {
  return universeId
    ? `/${universeId}`
    : '';
}

export function buildRoutePath(route: AppRoute): string {
  const universePrefix = getUniversePrefix(route.universeId);

  switch (route.page) {
    case 'landing':
      return '/';
    case 'launcher':
      return '/home';
    case 'auth': {
      const authPath = route.authMode === 'signup'
        ? '/signup'
        : route.authMode === 'forgotPassword'
          ? '/forgot-password'
          : route.authMode === 'resetPassword'
            ? '/reset-password'
            : '/login';

      return route.universeId
        ? `${universePrefix}${authPath}`
        : authPath;
    }
    case 'game':
      if (route.universeId && route.gameMode === 'character' && route.gameId === null) {
        return universePrefix;
      }

      return route.gameId === null
        ? `${universePrefix}/game/${route.gameMode}`
        : `${universePrefix}/game/${route.gameMode}/${route.gameId}`;
    case 'random':
      return route.gameMode === 'quote'
        ? `${universePrefix}/random/quote`
        : `${universePrefix}/random`;
    case 'history':
      return `${universePrefix}/archive/${route.gameMode}`;
    case 'leaderboard':
      return `${universePrefix}/leaderboard`;
    case 'premium':
      return '/premium';
    case 'profile':
      return `${universePrefix}/profile`;
    case 'support':
      return '/support';
    case 'about':
      return '/about';
    case 'howToPlay':
      return '/how-to-play';
    case 'privacyPolicy':
      return '/privacy-policy';
    case 'termsOfService':
      return '/terms';
    default:
      return '/';
  }
}
