import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apiFixture, game, savedProgress, scenarios } from './performance/fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const separator = argument.indexOf('=');
  if (!argument.startsWith('--') || separator < 0) throw new Error(`Expected --key=value: ${argument}`);
  return [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const label = options.label ?? 'local';
assert.match(label, /^[a-zA-Z0-9_-]+$/, 'Label must be safe for a filename.');
const dist = path.resolve(options.dist ?? path.join(root, 'dist'));
const output = path.resolve(options.output ?? path.join(tmpdir(), 'characterdle-performance', label));
const runs = options['validation-only'] === 'true' ? 0 : Number(options.runs ?? 3);
const observationMs = Number(options['observation-ms'] ?? 15000);
assert(Number.isInteger(runs) && (runs > 0 || options['validation-only'] === 'true'));
assert(Number.isFinite(observationMs) && observationMs >= 5000);
const selectedScenarios = options.scenarios
  ? scenarios.filter(scenario => options.scenarios.split(',').includes(scenario.name)) : scenarios;
assert(selectedScenarios.length > 0);
await access(path.join(dist, 'index.html'), constants.R_OK);
const manifestText = await readFile(path.join(dist, '.vite/manifest.json'), 'utf8');
const manifest = JSON.parse(manifestText);
if (options['assert-split'] === 'true') {
  for (const module of ['src/pages/AdminPage.tsx', 'src/pages/AuthPage.tsx', 'src/pages/ProfilePage.tsx',
    'src/components/layout/AccountSettingsOverlay.tsx', 'src/components/updates/LatestUpdatePopup.tsx']) {
    assert(manifest[module]?.isDynamicEntry, `Expected an independently lazy-loaded entry for ${module}.`);
  }
}
await mkdir(output, { recursive: true });

const bundledModules = path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
let playwright;
try {
  playwright = options.playwright
    ? await import(pathToFileURL(path.resolve(options.playwright, 'index.mjs')).href)
    : await import('playwright');
} catch (error) {
  if (options.playwright) throw error;
  playwright = await import(pathToFileURL(path.join(bundledModules, 'playwright/index.mjs')).href);
}
const candidates = [options.chromium, process.env.CHROMIUM_EXECUTABLE_PATH,
  playwright.chromium.executablePath(),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
].filter(Boolean);
let executablePath;
for (const candidate of candidates) {
  try { await access(candidate, constants.X_OK); executablePath = candidate; break; } catch { /* Try next installed browser. */ }
}
assert(executablePath, 'No Chromium executable found; pass --chromium=PATH.');

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const fileCache = new Map();
const unknownApiRequests = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/') || pathname.startsWith('/supabase/')) {
      const fixture = apiFixture(pathname, request.method);
      if (!fixture) unknownApiRequests.push(`${request.method} ${pathname}`);
      const body = fixture && fixture.body === undefined ? Buffer.alloc(0)
        : brotliCompressSync(Buffer.from(JSON.stringify(fixture?.body ?? { error: 'No local fixture. External forwarding is prohibited.' })),
          { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 } });
      response.writeHead(fixture?.status ?? 501, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'Content-Length': body.length, ...(body.length ? { 'Content-Encoding': 'br' } : {}) });
      response.end(body);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405); response.end(); return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    let filename = path.resolve(dist, relative);
    if (!filename.startsWith(`${dist}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    try { if (!(await stat(filename)).isFile()) throw new Error('Not a file'); }
    catch {
      if (!path.extname(filename)) filename += '.html';
      try { await access(filename); }
      catch {
        // Non-prerendered client routes use the same application shell for navigation validation only.
        if (!path.extname(relative)) filename = path.join(dist, 'index.html');
        else { response.writeHead(404); response.end(); return; }
      }
    }
    let file = fileCache.get(filename);
    if (!file) {
      const original = await readFile(filename);
      const contentType = mimeTypes[path.extname(filename)] ?? 'application/octet-stream';
      const compress = /^(text\/|application\/(json|manifest))/.test(contentType) || contentType === 'image/svg+xml';
      const body = compress ? brotliCompressSync(original, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 } }) : original;
      file = { original, body, contentType, compress }; fileCache.set(filename, file);
    }
    response.writeHead(200, { 'Content-Type': file.contentType, 'Content-Length': file.body.length,
      'Cache-Control': 'no-store', ...(file.compress ? { 'Content-Encoding': 'br' } : {}) });
    response.end(request.method === 'HEAD' ? undefined : file.body);
  } catch (error) {
    response.writeHead(500); response.end(String(error));
  }
});
server.on('connect', (_request, socket) => socket.destroy());
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const runtimeConfig = { apiBaseUrl: origin, supabaseUrl: `${origin}/supabase`, supabasePublishableKey: 'sb_publishable_local_benchmark_only' };
const settings = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  cpuSlowdown: 4, latencyMs: 150, downloadBytesPerSecond: 1_600_000 / 8,
  uploadBytesPerSecond: 750_000 / 8, observationMs, runs };
let browser;
const results = [];

async function prepareContext(scenario, desktop = false) {
  const context = await browser.newContext({ viewport: desktop ? { width: 1440, height: 1000 } : settings.viewport,
    deviceScaleFactor: desktop ? 1 : settings.deviceScaleFactor, isMobile: !desktop, hasTouch: !desktop,
    locale: 'en-US', timezoneId: 'America/New_York', colorScheme: 'dark', serviceWorkers: 'block' });
  const blocked = new Set();
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    blocked.add(`${url.origin}${url.pathname}`);
    await route.abort('blockedbyclient');
  });
  if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => socket.close());
  await context.addInitScript(({ config, progress, readySelector, gameId, diagnostic }) => {
    window.__CHARACTERDLE_PUBLIC_CONFIG__ = config;
    if (progress) localStorage.setItem(`${progress.mode}-game-state:guest:got:${gameId}`, JSON.stringify(progress.state));
    const metrics = window.__benchmark = { fcpMs: null, lcpMs: null, lcpElement: null, cls: 0,
      readyMs: null, longTasks: 0, longTaskDurationMs: 0, layoutShifts: [] };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') metrics.fcpMs = entry.startTime;
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(list => {
      const entry = list.getEntries().at(-1);
      metrics.lcpMs = entry.startTime;
      metrics.lcpElement = entry.element?.outerHTML.slice(0, 300) ?? null;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    let sessionValue = 0; let sessionStart = 0; let lastShift = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        if (entry.startTime - lastShift > 1000 || entry.startTime - sessionStart > 5000) {
          sessionValue = 0; sessionStart = entry.startTime;
        }
        sessionValue += entry.value; lastShift = entry.startTime;
        metrics.cls = Math.max(metrics.cls, sessionValue);
        metrics.layoutShifts.push({ time: entry.startTime, value: entry.value,
          sources: entry.sources?.map(source => ({ node: source.node?.outerHTML?.slice(0, 200),
            previousRect: source.previousRect.toJSON(), currentRect: source.currentRect.toJSON() })) ?? [] });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { metrics.longTasks += 1; metrics.longTaskDurationMs += entry.duration; }
    }).observe({ type: 'longtask', buffered: true });
    function observeReadiness() {
      const element = document.querySelector(readySelector);
      if (element && element.getBoundingClientRect().width > 0) { metrics.readyMs = performance.now(); return; }
      requestAnimationFrame(observeReadiness);
    }
    requestAnimationFrame(observeReadiness);
    if (diagnostic) {
      metrics.appStates = [];
      metrics.initialLazyFallbackObserved = false;
      let lastSignature = '';
      const observeState = () => {
        const root = document.getElementById('root');
        const footer = document.querySelector('.site-footer');
        const current = { time: performance.now(), prerendered: root?.hasAttribute('data-prerendered'),
          statusTexts: [...document.querySelectorAll('[role="status"]')].map(node => node.textContent?.trim()).filter(Boolean),
          gamePresent: !!document.querySelector('.game-page'),
          inputEnabled: !!document.querySelector('.search-box input:not(:disabled)'),
          footerTop: footer?.getBoundingClientRect().top ?? null,
          mainText: document.querySelector('main')?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 250) };
        const signature = JSON.stringify({ ...current, time: undefined });
        if (signature !== lastSignature && metrics.appStates.length < 60) {
          metrics.appStates.push(current); lastSignature = signature;
        }
      };
      new MutationObserver(() => {
        if ([...document.querySelectorAll('#root .page[role="status"]')].some(node => node.textContent?.trim() === 'Loading...')) {
          metrics.initialLazyFallbackObserved = true;
        }
        requestAnimationFrame(observeState);
      }).observe(document, { childList: true, subtree: true,
        attributes: true, attributeFilter: ['disabled', 'data-prerendered'] });
    }
  }, { config: runtimeConfig, readySelector: scenario.readySelector, gameId: game.id,
    progress: scenario.progressMode ? { mode: scenario.progressMode, state: savedProgress } : null,
    diagnostic: options.diagnostic === 'true' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (!desktop) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: settings.cpuSlowdown });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: settings.latencyMs,
      downloadThroughput: settings.downloadBytesPerSecond, uploadThroughput: settings.uploadBytesPerSecond,
      connectionType: 'cellular4g' });
  }
  const requests = new Map();
  cdp.on('Network.responseReceived', event => {
    requests.set(event.requestId, { url: event.response.url.replace(origin, ''), type: event.type,
      status: event.response.status, transferredBytes: event.response.encodedDataLength ?? 0, complete: false });
  });
  cdp.on('Network.loadingFinished', event => {
    const item = requests.get(event.requestId);
    if (item) { item.transferredBytes = event.encodedDataLength; item.complete = true; }
  });
  return { context, page, blocked, errors, requests };
}

async function measure(scenario, iteration) {
  const state = await prepareContext(scenario);
  try {
    await state.page.goto(`${origin}${scenario.pathname}`, { waitUntil: 'commit', timeout: 60000 });
    // Fixed navigation-relative window: do not stop early simply because a faster build looks ready.
    await state.page.waitForFunction(ms => performance.now() >= ms, observationMs, { timeout: observationMs + 30000 });
    const metrics = await state.page.evaluate(() => ({ ...window.__benchmark,
      observationEndMs: performance.now(), title: document.title,
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      resources: performance.getEntriesByType('resource').map(entry => ({ url: entry.name.replace(location.origin, ''),
        transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
        durationMs: entry.duration, startTimeMs: entry.startTime, responseEndMs: entry.responseEnd, initiator: entry.initiatorType })),
      images: [...document.images].filter(image => image.currentSrc.startsWith(location.origin)).map(image => ({
        url: image.currentSrc.replace(location.origin, ''), loaded: image.complete && image.naturalWidth > 0,
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight })),
    }));
    const requests = [...state.requests.values()];
    const total = type => requests.filter(item => !type || item.type === type).reduce((sum, item) => sum + item.transferredBytes, 0);
    const result = { scenario: scenario.name, iteration, ...metrics,
      bytes: { total: total(), js: total('Script'), css: total('Stylesheet'), images: total('Image'), document: total('Document'), fetch: total('Fetch') + total('XHR') },
      requests, blockedExternalRequests: [...state.blocked], errors: state.errors,
      unfinishedRequests: requests.filter(item => !item.complete && item.status === 200
        && ['Document', 'Script', 'Stylesheet', 'Image', 'Font'].includes(item.type)).map(item => item.url),
    };
    result.unrelatedInitialChunks = requests.filter(item => item.type === 'Script'
      && /\/(AdminPage|AuthPage|ProfilePage|AccountSettingsOverlay|AccountAvatarPicker|UpdatesPage|UpdateDialog|LatestUpdatePopup|PostComments)[-.]/.test(item.url)).map(item => item.url);
    results.push(result);
    if (iteration === 1) await captureScreenshot(state.page, `${scenario.name}-mobile.png`);
    console.log(JSON.stringify({ scenario: scenario.name, iteration, fcpMs: metrics.fcpMs, lcpMs: metrics.lcpMs,
      cls: metrics.cls, readyMs: metrics.readyMs, bytes: result.bytes, errors: state.errors,
      unfinished: result.unfinishedRequests.length }));
    assert(metrics.readyMs !== null, `${scenario.name}: interactive UI did not become ready.`);
    assert.equal(state.errors.length, 0, `${scenario.name}: browser errors.`);
    assert.equal(result.unfinishedRequests.length, 0, `${scenario.name}: increase observation-ms; transfers did not finish.`);
    if (options['assert-split'] === 'true') assert.deepEqual(result.unrelatedInitialChunks, [], `${scenario.name}: unrelated page code loaded initially.`);
    if (options.diagnostic === 'true' && options['assert-split'] === 'true')
      assert.equal(metrics.initialLazyFallbackObserved, false, `${scenario.name}: initial React.lazy fallback was mounted.`);
    assert.equal(metrics.horizontalOverflowPx, 0, `${scenario.name}: page-level horizontal overflow.`);
    assert(!requests.some(item => ['Document', 'Script', 'Stylesheet', 'Image'].includes(item.type) && item.status >= 400), `${scenario.name}: a local asset failed.`);
  } finally { await state.context.close(); }
}

async function captureScreenshot(page, name) {
  // Async image decoding can leave offscreen pixels blank in a full-page capture.
  // Do this after timing collection so it cannot improve measured paint/ready values.
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter(image => image.complete && image.naturalWidth > 0)
      .map(image => image.decode().catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: path.join(output, name), fullPage: true });
}

async function validateNavigation() {
  const checks = [];
  for (const desktop of [true, false]) {
    const size = desktop ? 'desktop' : 'mobile';
    const state = await prepareContext(scenarios[0], desktop);
    try {
      await state.page.goto(`${origin}/`);
      await state.page.locator(scenarios[0].readySelector).waitFor();
      const documentRequests = () => [...state.requests.values()].filter(item => item.type === 'Document').length;
      await state.page.getByRole('link', { name: 'Try without signing up', exact: true }).first().click();
      await state.page.waitForURL('**/got');
      await state.page.locator('.search-box input:not(:disabled)').waitFor();
      const initialDocuments = documentRequests();
      await state.page.locator('.game-mode-switch-button').click();
      await state.page.waitForURL('**/got/game/quote');
      await state.page.getByPlaceholder('Guess the speaker').waitFor();
      assert.equal(documentRequests(), initialDocuments, 'Expected client-side route navigation without a document reload.');
      await state.page.getByRole('button', { name: 'How to play Characterdle', exact: true }).click();
      await state.page.getByRole('dialog').waitFor();
      await state.page.keyboard.press('Escape');
      await state.page.getByRole('dialog').waitFor({ state: 'hidden' });
      await state.page.getByRole('button', { name: 'Updates', exact: true }).click();
      await state.page.getByRole('dialog').waitFor();
      await state.page.getByRole('heading', { name: 'Local benchmark update', exact: true }).waitFor();
      await state.page.getByRole('button', { name: 'Sign in to comment', exact: true }).waitFor();
      await captureScreenshot(state.page, `updates-dialog-${size}.png`);
      await state.page.getByRole('button', { name: 'Close update', exact: true }).click();
      await state.page.getByRole('dialog').waitFor({ state: 'hidden' });
      await state.page.getByRole('link', { name: 'About', exact: true }).click();
      await state.page.waitForURL('**/about');
      await state.page.locator('.informational-page').waitFor();
      // Navigation scrolls smoothly; screenshot only the settled top-of-page state.
      await state.page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await state.page.waitForTimeout(250);
      await captureScreenshot(state.page, `about-${size}.png`);
      await state.page.goto(`${origin}/`);
      await state.page.locator(scenarios[0].readySelector).waitFor();
      await state.page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await state.page.waitForURL('**/login');
      await state.page.locator('.auth-page input[type="email"]').waitFor();
      await state.page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await state.page.waitForTimeout(250);
      await captureScreenshot(state.page, `login-${size}.png`);
      assert.equal(state.errors.length, 0);
      checks.push({ size, passed: true, checks: ['landing -> character link', 'character -> quote without full reload', 'help modal opens/closes',
        'updates Markdown modal opens/closes', 'About secondary page', 'landing -> sign-in form (no login submitted)'] });
    } finally { await state.context.close(); }
  }
  return checks;
}

async function validateChunkRecovery() {
  const aboutFile = manifest['src/pages/AboutPage.tsx']?.file;
  assert(aboutFile, 'About page must have an independent chunk for this smoke test.');
  const checks = [];
  for (const fail of [true, false]) {
    const state = await prepareContext(scenarios[0], true);
    try {
      await state.page.goto(`${origin}/`);
      await state.page.locator(scenarios[0].readySelector).waitFor();
      await state.context.route(`${origin}/${aboutFile}`, async route => {
        if (fail) return route.abort('failed');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return route.continue();
      });
      await state.page.getByRole('link', { name: 'About', exact: true }).click();
      await state.page.waitForURL('**/about');
      if (fail) {
        await state.page.getByRole('alert').filter({ hasText: 'This part of Characterdle could not load.' }).waitFor();
        await state.page.getByRole('button', { name: 'Reload', exact: true }).waitFor();
      } else {
        await state.page.getByRole('status').filter({ hasText: /^Loading\.\.\.$/ }).waitFor();
      }
      assert(await state.page.locator('.site-header').isVisible(), 'Header must remain visible during deferred-page recovery.');
      await captureScreenshot(state.page, fail ? 'chunk-error-desktop.png' : 'chunk-loading-desktop.png');
      if (!fail) await state.page.locator('.informational-page').waitFor();
      checks.push({ check: fail ? 'Failed About chunk displays Reload and preserves header' : 'Slow About chunk displays fallback then loads successfully', passed: true });
    } finally { await state.context.close(); }
  }
  return checks;
}

function median(values) {
  const sorted = values.filter(value => value !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}
let failure;
let navigation;
let chunkRecovery;
try {
  browser = await playwright.chromium.launch({ headless: true, executablePath,
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--no-default-browser-check', '--disable-features=MediaRouter',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
  for (let iteration = 1; iteration <= runs; iteration += 1) {
    for (const scenario of selectedScenarios) await measure(scenario, iteration);
  }
  if (options.validation !== 'false') {
    navigation = await validateNavigation();
    if (options['assert-split'] === 'true' && options['validation-only'] === 'true') chunkRecovery = await validateChunkRecovery();
    for (const scenario of selectedScenarios) {
      const state = await prepareContext(scenario, true);
      try {
        await state.page.goto(`${origin}${scenario.pathname}`);
        await state.page.locator(scenario.readySelector).waitFor();
        await state.page.waitForTimeout(1500);
        await captureScreenshot(state.page, `${scenario.name}-desktop.png`);
      } finally { await state.context.close(); }
    }
  }
  assert.deepEqual(unknownApiRequests, [], 'An unmocked API request occurred. Nothing was forwarded.');
} catch (error) { failure = error; }
finally {
  const summary = selectedScenarios.filter(scenario => results.some(result => result.scenario === scenario.name)).map(scenario => {
    const samples = results.filter(result => result.scenario === scenario.name);
    return { scenario: scenario.name, samples: samples.length,
      fcpMs: median(samples.map(sample => sample.fcpMs)), lcpMs: median(samples.map(sample => sample.lcpMs)),
      cls: median(samples.map(sample => sample.cls)), readyMs: median(samples.map(sample => sample.readyMs)),
      bytes: Object.fromEntries(['total', 'js', 'css', 'images'].map(key => [key, median(samples.map(sample => sample.bytes[key]))])) };
  });
  const report = { label, dist, createdAt: new Date().toISOString(), browserVersion: browser?.version(), executablePath, settings,
    manifestSha256: createHash('sha256').update(manifestText).digest('hex'),
    assertSplitChunks: options['assert-split'] === 'true',
    limitations: ['Synthetic API fixtures, local HTTP server, no Cloudflare/Render/Supabase latency.',
      'All external requests (including Google Fonts, ads, analytics) blocked identically; screenshots use fallback fonts.',
      'Brotli quality 6 for HTML/JS/CSS/JSON/SVG; image bytes uncompressed.',
      'Cold isolated browser contexts with cache disabled, fixed observation window, no interaction before metric collection.',
      'Laboratory comparison, not field Core Web Vitals or INP; five-character fixture is not the full live catalog.',
      'CDP transferred bytes include response overhead; screenshots captured after metrics and excluded from timing.'],
    navigation, chunkRecovery, unknownApiRequests, failure: failure?.stack ?? null, summary, results };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const lines = ['# Characterdle Performance Benchmark', '', `Label: ${label}`, `Browser: ${report.browserVersion}`,
    `Mobile: 375 x 812, DPR 2, 4x CPU slowdown, 1.6 Mbps down / 0.75 Mbps up, 150 ms latency.`,
    runs > 0 ? `${runs} cold runs per scenario; ${observationMs / 1000}s observation window. Values below are medians.`
      : 'Validation-only run; no performance measurements collected.', ''];
  if (summary.length) lines.push(
    '| Scenario | FCP ms | LCP ms | CLS | UI ready ms | Total KiB | JS KiB | CSS KiB | Images KiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const row of summary) lines.push(`| ${row.scenario} | ${row.fcpMs?.toFixed(0)} | ${row.lcpMs?.toFixed(0)} | ${row.cls?.toFixed(4)} | ${row.readyMs?.toFixed(0)} | ${['total', 'js', 'css', 'images'].map(key => (row.bytes[key] / 1024).toFixed(1)).join(' | ')} |`);
  lines.push('', '## Limitations', ...report.limitations.map(item => `- ${item}`), '',
    `Validation: ${failure ? failure.message : 'passed'}`, `Navigation: ${JSON.stringify(navigation ?? 'not run')}`,
    `Chunk recovery: ${JSON.stringify(chunkRecovery ?? 'not run')}`, '');
  await writeFile(path.join(output, 'report.md'), lines.join('\n'));
  console.log(`Report: ${path.join(output, 'report.md')}`);
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (failure) throw failure;
