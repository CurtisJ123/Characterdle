import { mainSiteDefaultRoute, readRouteFromSegments } from '../lib/routeParser';
import type { AppRoute } from '../types/routes';

export { default as publicPaths } from './publicPaths.json';

export function routeForPath(pathname: string): AppRoute | null {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length ? readRouteFromSegments(segments) : mainSiteDefaultRoute;
}
