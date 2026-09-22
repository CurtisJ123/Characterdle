import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { createPageHandler, pageTemplate, publicPaths, renderDocument, resolveSeo, routeForPath } from '../dist-ssr/renderer.js';
import { collectStyles, pageEntries } from '../scripts/route-styles.mjs';

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

test('stylesheet collection follows static dependencies without loading secondary pages', () => {
  const manifest = {
    shell: { imports: ['shared'], css: ['shell.css'], dynamicImports: ['admin'] },
    shared: { imports: ['shell'], css: ['shared.css'] },
    admin: { css: ['admin.css'] },
  };
  assert.deepEqual(collectStyles(manifest, ['shell']), ['shared.css', 'shell.css']);
  assert.throws(() => collectStyles(manifest, ['missing']), /Missing build manifest entry/);
});

test('initial client dependency graph excludes lazy pages and Markdown rendering', async () => {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
  const initial = new Set();
  function visit(key) {
    if (initial.has(key)) return;
    initial.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  visit('index.html');
  visit('src/App.tsx');
  for (const entry of Object.values(pageEntries)) assert.ok(!initial.has(entry), `${entry} must stay deferred`);
  for (const key of initial) {
    const code = await readFile(new URL(manifest[key].file, dist), 'utf8');
    assert.ok(!code.includes('remarkGfm'), 'Markdown must not be required to play a game');
  }
});

test('prerendered routes include required page styles but exclude unrelated private styles', async () => {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
  const privateStyles = Object.values(manifest).filter(entry => /^(AdminPage|AuthPage|AccountSettingsOverlay|ProfilePage)$/.test(entry.name))
    .flatMap(entry => entry.css ?? []);
  const baseStyles = collectStyles(manifest, ['index.html', 'src/App.tsx']);
  for (const pathname of publicPaths) {
    const route = routeForPath(pathname);
    const html = await readFile(new URL(file(pathname), dist), 'utf8');
    const needed = [...baseStyles, ...(pageEntries[route.page] ? collectStyles(manifest, [pageEntries[route.page]]) : [])];
    for (const style of needed) assert.ok(html.includes(`href="/${style}"`), `${pathname} needs ${style}`);
    for (const style of privateStyles) assert.ok(!html.includes(`href="/${style}"`), `${pathname} must not load ${style}`);
  }
  const dynamicUpdate = renderDocument(pageTemplate, routeForPath('/updates/new-icons'), { updates: { path: '/updates/new-icons', post } });
  for (const style of collectStyles(manifest, [pageEntries.updates])) assert.ok(dynamicUpdate.includes(`href="/${style}"`));
});

test('initial public HTML uses the small logo while preserving the social image', async () => {
  for (const pathname of publicPaths) {
    const html = await readFile(new URL(file(pathname), dist), 'utf8');
    assert.match(html, /<img[^>]+src="\/brand\/characterdle-logo-small\.webp"[^>]+width="42"[^>]+height="42"/);
    assert.match(html, /property="og:image" content="https:\/\/characterdle\.com\/android-chrome-512x512\.png"/);
  }
  await access(new URL('brand/characterdle-logo-small.webp', dist));
});

test('shared header, feedback, and guest signup styling does not depend on visiting another page', async () => {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
  const css = async entries => (await Promise.all(collectStyles(manifest, entries)
    .map(file => readFile(new URL(file, dist), 'utf8')))).join('\n');
  const shared = await css(['index.html', 'src/App.tsx']);
  assert.match(shared, /\.updates-header-button\s*\{/);
  assert.match(shared, /\.updates-header-button svg\s*\{/);
  assert.match(shared, /\.updates-header-button>span\s*\{/);
  assert.match(shared, /\.auth-feedback\.is-error\s*\{/);
  assert.match(shared, /\.auth-feedback\.is-success\s*\{/);
  const game = await css([pageEntries.game]);
  assert.match(game, /\.auth-form input\s*\{/);
  assert.match(game, /\.password-visibility-button\s*\{/);
  assert.match(game, /\.google-auth-button\s*\{/);
});

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

test('daily character metadata stays descriptive while the initial game header stays minimal', async () => {
  const html = await readFile(new URL('got.html', dist), 'utf8');
  const seo = resolveSeo(routeForPath('/got'));
  assert.equal(seo.title, 'Game Of Thrones Characterdle');
  assert.match(seo.description, /free daily Game of Thrones character guessing game/);
  assert.equal(seo.canonicalUrl, 'https://characterdle.com/got');
  assert.match(html, /<section class="game-hero"><p class="eyebrow">Universe: Game of Thrones<\/p><h1>Daily Character Game<\/h1><\/section>/);
  assert.doesNotMatch(html, /game-introduction|inspired by Wordle/);
  const body = html.slice(html.indexOf('<body'));
  assert.ok(!body.includes(seo.description), 'The SEO description should not appear as visible game-page copy.');
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  for (const pathname of publicPaths) {
    const pageHtml = await readFile(new URL(file(pathname), dist), 'utf8');
    assert.doesNotMatch(resolveSeo(routeForPath(pathname)).title, /\bWordle\b/i);
    assert.doesNotMatch(pageHtml, /(?:property="og:title"|name="twitter:title") content="[^"]*Wordle/i);
  }
});

test('landing copy explains the game without a redundant play text link', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  assert.match(html, /<h1>Guess the Game of Thrones character\.<\/h1>/);
  assert.doesNotMatch(html, /landing-game-link|Play today&#x27;s Game of Thrones character game/);
  assert.match(html, /inspired by Wordle/);
  assert.match(html, /rel="canonical" href="https:\/\/characterdle\.com\/"/);
});

test('quote, archive and random routes retain their mode-specific titles and copy', () => {
  for (const [pathname, title] of [
    ['/got/game/quote', 'Daily Game of Thrones Quote Game | Characterdle'],
    ['/got/game/character/50', 'Game of Thrones Character Game #50 | Characterdle'],
    ['/got/game/quote/50', 'Game of Thrones Quote Game #50 | Characterdle'],
  ]) {
    const route = routeForPath(pathname);
    assert.equal(resolveSeo(route).title, title);
    assert.doesNotMatch(renderDocument(pageTemplate, route), /game-introduction|inspired by Wordle/);
  }
  for (const pathname of ['/got/random', '/got/random/quote']) {
    const route = routeForPath(pathname);
    assert.match(resolveSeo(route).robots, /^noindex/);
    assert.doesNotMatch(renderDocument(pageTemplate, route), /game-introduction|inspired by Wordle/);
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

test('existing archive routes use the same parser and canonical as the client', async () => {
  const handler = renderRequest(async () => Response.json({ available: true }));
  for (const pathname of ['/got/game/character/50', '/got/game/quote/50']) {
    const response = await handler(request(pathname), assets);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(`href="${resolveSeo(routeForPath(pathname)).canonicalUrl}"`));
  }
});

test('established aliases redirect permanently in one hop, retaining queries and host', async () => {
  const handler = renderRequest(() => { throw new Error('Aliases must not fetch data.'); });
  const aliases = [
    ['/launcher', '/home'], ['/landing', '/'], ['/game', '/got'], ['/game/50', '/got/game/character/50'],
    ['/got/game/character', '/got'], ['/got/history/quote', '/got/archive/quote'],
    ['/history/quote', '/got/archive/quote'], ['/archive', '/got/archive/character'],
    ['/auth/signup', '/signup'], ['/got/auth/reset-password', '/got/reset-password'],
    ['/refund-policy', '/terms'], ['/subscription-cancellation', '/terms'],
    ['/got/game/quote/0050', '/got/game/quote/50'], ['/random/character', '/got/random'],
    ['/got/', '/got'], ['/about/', '/about'], ['/about.html', '/about'],
    ['/got/index.html', '/got'], ['/index.html', '/'], ['/updates.html', '/updates'],
  ];
  for (const host of ['characterdle.com', 'www.characterdle.com', 'staging.characterdle.com']) {
    for (const [source, target] of aliases) {
      const query = '?code=callback-code&checkout=success&session_id=example&next=%2Fgot';
      const response = await handler(new Request(`https://${host}${source}${query}`), assets);
      assert.equal(response.status, 301, source);
      assert.equal(response.headers.get('Location'), `https://${host}${target}${query}`, source);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(resolveSeo(routeForPath(target)).canonicalUrl, `https://characterdle.com${target}`);
    }
  }
});

test('invalid modes, IDs, slugs and extra segments are not routes or redirects', async () => {
  const handler = renderRequest(() => { throw new Error('Invalid routes must not fetch data.'); });
  for (const pathname of [
    '/made-up-url', '/about/extra', '/home/extra', '/admin/extra', '/login/extra',
    '/got/leaderboard/extra', '/got/game/character/not-a-number', '/got/game/quote/0',
    '/got/game/quote/-1', '/got/game/quote/1e3', '/got/game/quote/1.0',
    '/got/game/character/9007199254740992', '/got/game/character/50/extra',
    '/got/game/no-such-mode', '/got/game/50/extra', '/got/random/bad', '/got/archive/bad',
    '/updates/new-icons/extra', '/updates/Not_A_Slug', '/auth/bad', '/got//game/quote',
  ]) {
    assert.equal(routeForPath(pathname), null, pathname);
    const response = await handler(request(pathname), assets);
    assert.equal(response.status, 404, pathname);
    assert.equal(response.headers.get('Location'), null);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow', pathname);
    const html = await response.text();
    assert.doesNotMatch(html, /<script[^>]*type="module"/);
    if (!/\.[a-z0-9]+$/i.test(pathname)) assert.match(html, /<h1>Page not found<\/h1>/);
  }
});

test('game existence checks are anonymous, mode-specific, and contain no game data', async () => {
  for (const mode of ['character', 'quote']) {
    const handler = renderRequest(async (url, init) => {
      assert.equal(url, `https://api.example.test/api/universes/got/games/50/availability/${mode}`);
      assert.deepEqual(init.headers, { Accept: 'application/json' });
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'manual');
      return Response.json({ available: true, answer: 'DO_NOT_RENDER' });
    });
    const response = await handler(request(`/got/game/${mode}/50?token=secret`, {
      headers: { Cookie: 'session=secret', Authorization: 'Bearer secret' },
    }), assets);
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /DO_NOT_RENDER|Bearer secret|session=secret/);
  }
});

test('a confirmed missing or unreleased game returns a real non-booting 404', async () => {
  const handler = renderRequest(async () => Response.json({ available: false }));
  for (const method of ['GET', 'HEAD']) {
    const response = await handler(request('/got/game/quote/999999999', { method }), assets);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    const html = await response.text();
    if (method === 'HEAD') assert.equal(html, '');
    else {
      assert.match(html, /<h1>Page not found<\/h1>/);
      assert.doesNotMatch(html, /<script[^>]*type="module"/);
    }
  }
});

test('unavailable, old, redirected or malformed availability APIs produce retryable 503, not 404', async () => {
  for (const result of [
    () => { throw new Error('offline'); },
    () => new Response(null, { status: 404 }),
    () => new Response(null, { status: 503 }),
    () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example' } }),
    () => Response.json({}), () => Response.json({ available: 'false' }),
  ]) {
    const handler = renderRequest(async () => result());
    const response = await handler(request('/got/game/character/50'), assets);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /Game temporarily unavailable/);
    assert.equal((await handler(request('/got'), assets)).status, 200);
    assert.equal((await handler(request('/premium'), assets)).status, 200);
  }
});

test('canonical static pages, assets and callback URLs are not redirected', async () => {
  const handler = renderRequest(() => { throw new Error('No API calls expected.'); });
  for (const pathname of ['/got', '/premium?checkout=success&session_id=example', '/?code=example', '/reset-password?code=example']) {
    const response = await handler(request(pathname), assets);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Location'), null);
  }
  assert.equal((await handler(request('/got', { method: 'HEAD' }), assets)).body, null);
  assert.equal((await handler(request('/assets/missing.js'), assets)).status, 404);
});

test('Cloudflare sends HTML routes to the Worker while keeping heavy assets asset-first', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.not_found_handling, 'none');
  assert.deepEqual(config.assets.run_worker_first, ['/*', '!/assets/*', '!/brand/*', '!/images/*']);
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
