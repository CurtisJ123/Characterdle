import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteOrigin = 'https://characterdle.com';
const socialImagePath = '/brand/characterdle-logo.png';

const routePages = [
  {
    description: 'Play today\'s Game of Thrones character guessing game in Characterdle and deduce the hidden answer through attributes, seasons, and status clues.',
    outputPath: 'got.html',
    path: '/got',
    socialImageVersion: 'daily-character-v1',
    title: 'Daily Game of Thrones Character Game | Characterdle',
  },
  {
    description: 'Play today\'s Game of Thrones quote guessing game in Characterdle and identify who said the line before using all your hints.',
    outputPath: 'got/game/quote.html',
    path: '/got/game/quote',
    socialImageVersion: 'daily-quote-v1',
    title: 'Daily Game of Thrones Quote Game | Characterdle',
  },
];

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceRequired(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(`Unable to find ${label} in the generated index.html.`);
  }

  return html.replace(pattern, replacement);
}

function setTitle(html, title) {
  return replaceRequired(
    html,
    /<title>[^<]*<\/title>/,
    `<title>${escapeAttribute(title)}</title>`,
    'the title element',
  );
}

function setCanonicalUrl(html, canonicalUrl) {
  return replaceRequired(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />`,
    'the canonical link',
  );
}

function setMeta(html, attributeName, attributeValue, content) {
  const pattern = new RegExp(
    `<meta\\s+${attributeName}="${escapePattern(attributeValue)}"\\s+content="[^"]*"\\s*\\/?>`,
  );

  return replaceRequired(
    html,
    pattern,
    `<meta ${attributeName}="${attributeValue}" content="${escapeAttribute(content)}" />`,
    `${attributeValue} metadata`,
  );
}

function renderRouteHtml(indexHtml, routePage) {
  const canonicalUrl = `${siteOrigin}${routePage.path}`;
  const socialImageUrl = `${siteOrigin}${socialImagePath}?v=${routePage.socialImageVersion}`;
  let html = setTitle(indexHtml, routePage.title);

  html = setCanonicalUrl(html, canonicalUrl);
  html = setMeta(html, 'name', 'description', routePage.description);
  html = setMeta(html, 'property', 'og:url', canonicalUrl);
  html = setMeta(html, 'property', 'og:title', routePage.title);
  html = setMeta(html, 'property', 'og:description', routePage.description);
  html = setMeta(html, 'property', 'og:image', socialImageUrl);
  html = setMeta(html, 'property', 'og:image:secure_url', socialImageUrl);
  html = setMeta(html, 'property', 'og:image:width', '1024');
  html = setMeta(html, 'property', 'og:image:height', '1024');
  html = setMeta(html, 'property', 'og:image:alt', 'Characterdle logo');
  html = setMeta(html, 'name', 'twitter:card', 'summary');
  html = setMeta(html, 'name', 'twitter:url', canonicalUrl);
  html = setMeta(html, 'name', 'twitter:title', routePage.title);
  html = setMeta(html, 'name', 'twitter:description', routePage.description);
  html = setMeta(html, 'name', 'twitter:image', socialImageUrl);
  html = setMeta(html, 'name', 'twitter:image:alt', 'Characterdle logo');

  return html;
}

async function main() {
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const distDirectory = path.resolve(scriptsDirectory, '..', 'dist');
  const indexHtml = await readFile(path.join(distDirectory, 'index.html'), 'utf8');

  await Promise.all(routePages.map(async (routePage) => {
    const outputFile = path.join(distDirectory, routePage.outputPath);

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, renderRouteHtml(indexHtml, routePage), 'utf8');
  }));
}

await main();
