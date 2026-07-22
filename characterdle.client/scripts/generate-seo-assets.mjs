import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteOrigin = 'https://characterdle.com';
const publisherId = 'pub-2618219034381751';
const currentDate = new Date().toISOString().slice(0, 10);

const sitemapEntries = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/home', changefreq: 'daily', priority: '0.9' },
  { path: '/got', changefreq: 'daily', priority: '1.0' },
  { path: '/got/game/quote', changefreq: 'daily', priority: '0.9' },
  { path: '/got/archive/character', changefreq: 'weekly', priority: '0.8' },
  { path: '/got/archive/quote', changefreq: 'weekly', priority: '0.8' },
  { path: '/got/leaderboard', changefreq: 'daily', priority: '0.8' },
  { path: '/premium', changefreq: 'weekly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/how-to-play', changefreq: 'monthly', priority: '0.7' },
  { path: '/support', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy-policy', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'monthly', priority: '0.5' },
];

const robotsLines = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${siteOrigin}/sitemap.xml`,
  '',
];

function buildSitemapXml() {
  const urls = sitemapEntries.map((entry) => `  <url>
    <loc>${siteOrigin}${entry.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const publicDirectory = path.resolve(scriptsDirectory, '..', 'public');

  await mkdir(publicDirectory, { recursive: true });

  await Promise.all([
    writeFile(path.join(publicDirectory, 'sitemap.xml'), buildSitemapXml(), 'utf8'),
    writeFile(path.join(publicDirectory, 'robots.txt'), robotsLines.join('\n'), 'utf8'),
    writeFile(path.join(publicDirectory, 'ads.txt'), `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, 'utf8'),
  ]);
}

await main();
