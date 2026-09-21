import { useEffect } from 'react';
import { applyPageSeo } from '../../lib/pageSeo';
import { resolveAnnouncementSeo, resolveSeo, type SeoDefinition } from '../../seo/metadata';
import { readPublicUpdates } from '../../seo/publicUpdates';
import type { AppRoute } from '../../types/routes';

export function SeoManager({ route, override }: { route: AppRoute; override?: SeoDefinition }) {
  useEffect(() => {
    const post = route.page === 'updates' && route.postSlug
      ? readPublicUpdates(`/updates/${encodeURIComponent(route.postSlug)}`)?.post : undefined;
    applyPageSeo(override ?? (post ? resolveAnnouncementSeo(post) : resolveSeo(route)));
  }, [route, override]);
  return null;
}
