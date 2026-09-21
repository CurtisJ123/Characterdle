import { renderDocument } from './render';
import { publicPaths, routeForPath } from './publicRoutes';
import { resolveSeo } from './metadata';
import type { Announcement, AnnouncementPage } from '../types/announcements';
import type { PublicUpdates } from './publicUpdates';

declare const __HTML_TEMPLATE__: string;
declare const __PUBLIC_API_ORIGIN__: string;
declare const __STAGING_BUILD__: boolean;

interface Assets { fetch(request: Request): Promise<Response> }

// Exported for build-time rendering and offline HTTP regression tests.
export { renderDocument, publicPaths, routeForPath, resolveSeo };
export const pageTemplate = __HTML_TEMPLATE__;

function publishedPost(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object') return null;
  const post = value as Announcement;
  if (post.status !== 'published' || typeof post.publishedAt !== 'string'
    || !Number.isFinite(Date.parse(post.publishedAt)) || Date.parse(post.publishedAt) > Date.now()
    || typeof post.id !== 'string' || typeof post.slug !== 'string' || typeof post.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(post.updatedAt))
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)
    || typeof post.title !== 'string' || typeof post.summary !== 'string' || typeof post.bodyMarkdown !== 'string') return null;
  // Explicitly allow only public fields; never serialize arbitrary API properties.
  return { id: post.id, slug: post.slug, title: post.title, summary: post.summary,
    bodyMarkdown: post.bodyMarkdown, status: 'published', showPopup: false,
    publishedAt: post.publishedAt, updatedAt: post.updatedAt };
}

export function createPageHandler(template: string, apiOrigin: string, staging: boolean, fetchPublic = fetch) {
  return async (request: Request, env: { ASSETS: Assets }): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const route = routeForPath(pathname);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    const noindex = staging || !['characterdle.com', 'www.characterdle.com'].includes(url.hostname);
    // Static assets and prerendered public pages retain Cloudflare's asset caching.
    if (route?.page !== 'updates' && (publicPaths.includes(pathname) || /\.[a-z0-9]+$/i.test(pathname))) {
      const response = await env.ASSETS.fetch(request);
      if (!noindex) return response;
      const headers = new Headers(response.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(response.body, { status: response.status, headers });
    }
    let status = route ? 200 : 404;
    let updates: PublicUpdates | undefined;
    let error: string | undefined;
    if (route?.page === 'updates') {
      try {
        if (!apiOrigin) throw new Error('Public API origin is not configured.');
        const endpoint = route.postSlug ? `/api/updates/by-slug/${encodeURIComponent(route.postSlug)}` : '/api/updates?page=1';
        // Never forward visitor cookies, tokens, query parameters, or authorization.
        const response = await fetchPublic(`${apiOrigin}${endpoint}`, {
          headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(5000),
        });
        if (response.status === 404) {
          status = 404; error = 'This update is not available.';
        } else if (!response.ok) throw new Error('Public updates request failed.');
        else if (route.postSlug) {
          const post = publishedPost(await response.json());
          if (!post || post.slug !== route.postSlug) { status = 404; error = 'This update is not available.'; }
          else updates = { path: pathname, post };
        } else {
          const data = await response.json() as AnnouncementPage<unknown>;
          if (!Array.isArray(data.items)) throw new Error('Invalid updates response.');
          updates = { path: pathname, list: { page: 1, hasNextPage: data.hasNextPage === true,
            items: data.items.map(publishedPost).filter((post): post is Announcement => post !== null) } };
        }
      } catch (failure) {
        console.warn('Public update rendering failed:', failure instanceof Error ? failure.message : 'Unknown error');
        status = 503; error = 'Updates are temporarily unavailable. Please try again shortly.';
      }
    }
    const fallback = routeForPath('/')!;
    const seo = !route ? { ...resolveSeo(fallback), title: 'Page not found | Characterdle',
      description: 'This page could not be found.', canonicalUrl: `https://characterdle.com${pathname}`, robots: 'noindex,nofollow', structuredData: null }
      : error ? { ...resolveSeo(route), title: 'Update unavailable | Characterdle', description: error, robots: 'noindex,nofollow', structuredData: null } : undefined;
    const html = renderDocument(template, route ?? fallback, { updates, error, seo, notFound: !route, noindex: noindex || status !== 200 });
    const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (noindex || status !== 200 || (route && resolveSeo(route).robots.startsWith('noindex'))) headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (status === 503) headers.set('Retry-After', '60');
    return new Response(request.method === 'HEAD' ? null : html, { status, headers });
  };
}

export default { fetch: createPageHandler(__HTML_TEMPLATE__, __PUBLIC_API_ORIGIN__, __STAGING_BUILD__) };
