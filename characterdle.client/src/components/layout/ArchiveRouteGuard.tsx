import { useEffect, useState, type ReactNode } from 'react';
import { fetchGameAvailability, gameAvailabilityPath } from '../../lib/gameAvailability';
import { buildApiUrl } from '../../lib/runtimeConfig';
import { buildRoutePath } from '../../lib/routePaths';
import { resolveErrorSeo } from '../../seo/metadata';
import { RouteErrorPage } from '../../pages/RouteErrorPage';
import { SeoManager } from '../seo/SeoManager';
import type { AppRoute } from '../../types/routes';

// Keyed by route in App: a late response cannot replace another board's state.
export function ArchiveRouteGuard({ route, children }: { route: AppRoute; children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'available' | 404 | 503>('loading');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    let active = true;
    const url = buildApiUrl(gameAvailabilityPath(route.universeId!, route.gameId!, route.gameMode));
    void fetchGameAvailability(url, controller.signal)
      .then(available => { if (active) setStatus(available ? 'available' : 404); })
      .catch(() => { if (active) setStatus(503); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [route.gameId, route.gameMode, route.universeId]);

  if (status === 'available') return children;
  if (status === 'loading') return <main className="page centered-page" role="status">Loading game...</main>;
  return <>
    <SeoManager route={route} override={resolveErrorSeo(buildRoutePath(route), status)} />
    <RouteErrorPage status={status} />
  </>;
}
