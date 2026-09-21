import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const environment = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const staging = environment.VITE_DEPLOYMENT_ENVIRONMENT?.trim().toLowerCase() === 'staging';
const apiOrigin = environment.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
if (apiOrigin && !/^https?:\/\//.test(apiOrigin)) throw new Error('VITE_API_BASE_URL must be an absolute HTTP(S) URL.');
let template = await readFile(path.join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8'));
const styles = [...new Set(Object.values(manifest).flatMap(entry => entry.css ?? []))];
template = template.replace('</head>', () => styles.filter(file => !template.includes(`/${file}`))
  .map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n') + '</head>');

await build({
  root, configFile: false, plugins: [react()], publicDir: false,
  ssr: { target: 'webworker', noExternal: true, resolve: { conditions: ['workerd', 'module', 'production'] } },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __HTML_TEMPLATE__: JSON.stringify(template),
    __PUBLIC_API_ORIGIN__: JSON.stringify(apiOrigin),
    __STAGING_BUILD__: JSON.stringify(staging),
  },
  build: { ssr: 'src/seo/worker.ts', outDir: 'dist-ssr', emptyOutDir: true,
    rolldownOptions: { output: { entryFileNames: 'renderer.js' } } },
});
// Workerd entry modules may only expose handlers, not the build/test utilities.
await writeFile(path.join(root, 'dist-ssr/worker.js'), "export { default } from './renderer.js';\n");
const { renderDocument, publicPaths, routeForPath } = await import(pathToFileURL(path.join(root, 'dist-ssr/renderer.js')).href);
for (const pathname of publicPaths) {
  const output = path.join(dist, pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderDocument(template, routeForPath(pathname), { noindex: staging }));
}
console.log(`Prerendered ${publicPaths.length} public routes; generated Cloudflare page Worker.`);
