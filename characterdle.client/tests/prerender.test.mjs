import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { createPageHandler, pageTemplate, publicPaths, renderDocument, resolveSeo, routeForPath } from '../dist-ssr/renderer.js';

const dist = new URL('../dist/', import.meta.url);
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const file = pathname => pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`;
const post = {
  id: 'public-id', slug: 'new-icons', title: 'New streak icons', summary: 'Updated streak rewards.',
  bodyMarkdown: '# Streak icons\n\n**New icons** are here.\n\n![Icons](/brand/characterdle-logo.png)',
  status: 'published', publishedAt: '2026-09-20T12:00:00Z', updatedAt: '2026-09-20T12:00:00Z', showPopup: true,
};
const assets = { ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  try { return new Response(await readFile(new URL(file(pathname), dist)), { headers: { 'Content-Type': 'text/html' } }); }
  catch { return new Response('Not found', { status: 404 }); }
} } };
const request = (pathname, init) => new Request(`https://characterdle.com${pathname}`, init);
const renderRequest = (fetchPublic, staging = false) => createPageHandler(pageTemplate, 'https://api.example.test', staging, fetchPublic);

test('all sitemap routes have distinct initial metadata, visible content, and built styles', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', dist), 'utf8');
  const titles = new Set();
  for (const pathname of publicPaths) {
    const html = await readFile(new URL(file(pathname), dist), 'utf8');
    const seo = resolveSeo(routeForPath(pathname));
    assert.ok(sitemap.includes(`<loc>https://characterdle.com${pathname}</loc>`));
    assert.ok(html.includes(`<title>${escape(seo.title)}</title>`), pathname);
    assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, pathname);
    assert.ok(html.includes(`rel="canonical" href="${seo.canonicalUrl}"`), pathname);
    assert.ok(html.includes(`property="og:url" content="${seo.canonicalUrl}"`), pathname);
    assert.ok(html.includes(`name="description" content="${escape(seo.description)}"`), pathname);
    assert.match(html, /<div id="root" data-prerendered="true">.*<h1[ >]/s, pathname);
    assert.doesNotMatch(html, /<div id="root"><\/div>/, pathname);
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)) await access(new URL(match[1].slice(1), dist));
    assert.match(html, /<link rel="stylesheet" href="\/assets\/App-[^"]+"/);
    titles.add(seo.title);
  }
  assert.equal(titles.size, publicPaths.length);
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, publicPaths.length);
  assert.doesNotMatch(sitemap, /<lastmod>/); // Build dates are not content modification dates.
});

test('every public route can be rendered noindex for staging', () => {
  for (const pathname of publicPaths) {
    const html = renderDocument(pageTemplate, routeForPath(pathname), { noindex: true });
    assert.match(html, /name="robots" content="noindex,nofollow"/);
  }
});

test('private and practice routes return noindex without user data', async () => {
  const handler = renderRequest(() => { throw new Error('No API calls allowed.'); });
  for (const pathname of ['/login', '/signup', '/reset-password', '/got/profile', '/admin', '/got/random', '/got/random/quote']) {
    const response = await handler(request(pathname), assets);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    const html = await response.text();
    assert.match(html, /name="robots" content="noindex,nofollow/);
    assert.doesNotMatch(html, /access_token|stripe_customer|email@|public-updates/);
    assert.ok(html.includes(`href="${resolveSeo(routeForPath(pathname)).canonicalUrl}"`));
  }
});

test('existing archive and alias routes use the same parser and canonical as the client', async () => {
  const handler = renderRequest(() => { throw new Error('No API calls allowed.'); });
  for (const pathname of ['/got/game/character/50', '/got/game/quote/50', '/got/history/quote', '/auth/signup', '/refund-policy']) {
    const response = await handler(request(pathname), assets);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(`href="${resolveSeo(routeForPath(pathname)).canonicalUrl}"`));
  }
});

test('published updates render full safe Markdown and preserve initial data for the browser', async () => {
  const handler = renderRequest(async (url, init) => {
    assert.equal(url, 'https://api.example.test/api/updates/by-slug/new-icons');
    assert.deepEqual(init.headers, { Accept: 'application/json' });
    assert.equal(init.redirect, 'manual');
    return Response.json({ ...post, privateAdminNotes: 'DO_NOT_RENDER' });
  });
  const response = await handler(request('/updates/new-icons?access_token=secret', { headers: { Cookie: 'session=secret', Authorization: 'Bearer secret' } }), assets);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const html = await response.text();
  assert.match(html, /<strong>New icons<\/strong>/);
  assert.match(html, /<img[^>]+src="\/brand\/characterdle-logo.png"/);
  assert.match(html, /<title>New streak icons \| Characterdle<\/title>/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /id="public-updates"/);
  assert.doesNotMatch(html, /DO_NOT_RENDER|Bearer secret|access_token=secret|Comment/);
});

test('new/edited posts appear on the next request without rebuilding', async () => {
  let title = 'Before editing';
  const handler = renderRequest(async () => Response.json({ ...post, title }));
  assert.match(await (await handler(request('/updates/new-icons'), assets)).text(), /Before editing/);
  title = 'After editing';
  assert.match(await (await handler(request('/updates/new-icons'), assets)).text(), /After editing/);
});

test('public update list excludes drafts and private API fields', async () => {
  const handler = renderRequest(async url => {
    assert.equal(url, 'https://api.example.test/api/updates?page=1');
    return Response.json({ items: [post, { ...post, status: 'draft', title: 'Secret draft' }], page: 1, hasNextPage: true, token: 'private' });
  });
  const html = await (await handler(request('/updates'), assets)).text();
  assert.match(html, /href="\/updates\/new-icons"/);
  assert.match(html, /Updated streak rewards/);
  assert.doesNotMatch(html, /Secret draft|"token"/);
});

test('unpublished and missing posts return 404 and noindex', async () => {
  for (const result of [new Response(null, { status: 404 }), Response.json({ ...post, status: 'draft' })]) {
    const response = await renderRequest(async () => result)(request('/updates/new-icons'), assets);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(await response.text(), /Update unavailable/);
  }
});

test('updates API failures return retryable 503 while other pages still work', async () => {
  const handler = renderRequest(async () => { throw new Error('offline'); });
  const response = await handler(request('/updates/new-icons'), assets);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.match(await response.text(), /temporarily unavailable/);
  assert.equal((await handler(request('/about'), assets)).status, 200);
});

test('public update fetches never follow an API redirect to another destination', async () => {
  const handler = renderRequest(async (_url, init) => {
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example' } });
  });
  assert.equal((await handler(request('/updates'), assets)).status, 503);
});

test('HTML metadata, JSON-LD, initial state and Markdown cannot inject executable markup', async () => {
  const dangerous = { ...post, title: '</title><script>alert(1)</script>', summary: '"/><img src=x onerror=alert(1)>',
    bodyMarkdown: '<script>alert(2)</script>\n\n[bad](javascript:alert(3))\n\n![bad](javascript:alert(4))\n\nSafe **text** $&' };
  const html = await (await renderRequest(async () => Response.json(dangerous))(request('/updates/new-icons'), assets)).text();
  assert.doesNotMatch(html, /<script>alert|<img src=x|href="javascript:|src="javascript:/);
  assert.match(html, /&lt;\/title&gt;/);
  assert.match(html, /\\u003c\/script\\u003e/);
  assert.match(html, /Safe <strong>text<\/strong> \$&amp;/);
});

test('HEAD, method restrictions, unknown routes, and staging response headers', async () => {
  const handler = renderRequest(async () => Response.json(post), true);
  const head = await handler(request('/updates/new-icons', { method: 'HEAD' }), assets);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal((await handler(request('/updates', { method: 'POST' }), assets)).status, 405);
  const missing = await handler(request('/does-not-exist'), assets);
  assert.equal(missing.status, 404);
  const html = await missing.text();
  assert.match(html, /<h1>Page not found<\/h1>/);
  assert.doesNotMatch(html, /<script[^>]*type="module"/);
});
