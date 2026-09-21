import { mainSiteDefaultRoute, readRouteFromSegments } from '../lib/routeParser';
import type { AppRoute } from '../types/routes';

import publicPaths from './publicPaths.json';
export { publicPaths };

export function routeForPath(pathname: string): AppRoute | null {
  if (!pathname.startsWith('/') || pathname.includes('//')) return null;
  let path = pathname.replace(/\/+$/, '') || '/';
  // Resolve only known public HTML files so their aliases can redirect too.
  const fileAlias = path.replace(/\/index(?:\.html)?$/, '').replace(/\.html$/, '') || '/';
  if (publicPaths.includes(fileAlias)) path = fileAlias;
  const segments = path === '/' ? [] : path.slice(1).split('/');
  return segments.length ? readRouteFromSegments(segments) : mainSiteDefaultRoute;
}
