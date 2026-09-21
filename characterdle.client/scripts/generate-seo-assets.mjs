import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import publicPaths from '../src/seo/publicPaths.json' with { type: 'json' };

const siteOrigin = 'https://characterdle.com';
const publisherId = 'pub-2618219034381751';
const environment = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const isStagingBuild = environment.VITE_DEPLOYMENT_ENVIRONMENT?.trim().toLowerCase() === 'staging';


const robotsLines = isStagingBuild
  ? [
      'User-agent: *',
      'Allow: /',
      '',
    ]
  : [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${siteOrigin}/sitemap.xml`,
      'Sitemap: https://characterdle-api-vtnh.onrender.com/api/updates/sitemap.xml',
      '',
    ];

function buildSitemapXml() {
  const urls = publicPaths.map((pathname) => `  <url>
    <loc>${siteOrigin}${pathname}</loc>
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
