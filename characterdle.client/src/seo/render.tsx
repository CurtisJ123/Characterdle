import { renderToStaticMarkup } from 'react-dom/server.edge';
import { PublicPage } from './PublicPage';
import { resolveAnnouncementSeo, resolveSeo, type SeoDefinition } from './metadata';
import type { PublicUpdates } from './publicUpdates';
import type { AppRoute } from '../types/routes';

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

export function renderDocument(template: string, route: AppRoute, options: {
  noindex?: boolean; updates?: PublicUpdates; error?: string; seo?: SeoDefinition; notFound?: boolean;
} = {}): string {
  const seo = options.seo ?? (options.updates?.post ? resolveAnnouncementSeo(options.updates.post) : resolveSeo(route));
  const robots = options.noindex ? 'noindex,nofollow' : seo.robots;
  let html = template.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, () => `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`);
  for (const [name, content] of Object.entries({
    description: seo.description, robots,
    'og:title': seo.title, 'og:description': seo.description, 'og:url': seo.canonicalUrl,
    'twitter:title': seo.title, 'twitter:description': seo.description, 'twitter:url': seo.canonicalUrl,
  })) {
    const attribute = name.startsWith('og:') ? 'property' : 'name';
    const pattern = new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="[^"]*"\\s*\\/?>`);
    if (!pattern.test(html)) throw new Error(`Missing HTML metadata: ${name}`);
    html = html.replace(pattern, () => `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`);
  }
  html = html.replace('</head>', () => `${seo.structuredData
    ? `<script type="application/ld+json" data-characterdle-seo="page-jsonld">${safeJson(seo.structuredData)}</script>` : ''}</head>`);
  const body = renderToStaticMarkup(options.notFound
    ? <main className="page informational-page"><section className="glass-card informational-hero">
      <div><h1>Page not found</h1><p>This page could not be found.</p><a href="/home">Back to Characterdle</a></div>
    </section></main>
    : <PublicPage route={route} updates={options.updates} error={options.error} />);
  if (!html.includes('<div id="root"></div>')) throw new Error('Missing empty root in HTML template.');
  html = html.replace('<div id="root"></div>', () => `<div id="root" data-prerendered="true">${body}</div>`);
  // Unknown URLs must stay a 404, rather than booting the SPA's homepage fallback.
  if (options.notFound) html = html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '');
  if (options.updates) html = html.replace('</body>', () =>
    `<script type="application/json" id="public-updates">${safeJson(options.updates)}</script></body>`);
  return html;
}
