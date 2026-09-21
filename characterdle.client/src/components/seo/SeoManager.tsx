import { useEffect } from 'react';
import { applyPageSeo } from '../../lib/pageSeo';
import { resolveAnnouncementSeo, resolveSeo } from '../../seo/metadata';
import { readPublicUpdates } from '../../seo/publicUpdates';
import type { AppRoute } from '../../types/routes';

export function SeoManager({ route }: { route: AppRoute }) {
  useEffect(() => {
    const post = route.page === 'updates' && route.postSlug
      ? readPublicUpdates(`/updates/${encodeURIComponent(route.postSlug)}`)?.post : undefined;
    applyPageSeo(post ? resolveAnnouncementSeo(post) : resolveSeo(route));
  }, [route]);
  return null;
}
