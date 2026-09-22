import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const [baselineDirectory, baselineValidationDirectory, afterDirectory, outputPath] = process.argv.slice(2);
assert(baselineDirectory && baselineValidationDirectory && afterDirectory,
  'Usage: node scripts/performance/compare-screenshots.mjs BASELINE BASELINE_VALIDATION AFTER [output.json]');
const require = createRequire(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'));
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default ?? require('pixelmatch');
const comparisons = [];
for (const name of (await readdir(afterDirectory)).filter(filename => filename.endsWith('.png'))) {
  const validation = /^(about|login|updates-dialog)-/.test(name);
  const before = PNG.sync.read(await readFile(path.join(validation ? baselineValidationDirectory : baselineDirectory, name)));
  const after = PNG.sync.read(await readFile(path.join(afterDirectory, name)));
  const sameDimensions = before.width === after.width && before.height === after.height;
  const differingPixels = sameDimensions
    ? pixelmatch(before.data, after.data, null, after.width, after.height, { threshold: 0.1 }) : null;
  comparisons.push({ name, before: { width: before.width, height: before.height },
    after: { width: after.width, height: after.height }, sameDimensions, differingPixels,
    differingPercent: differingPixels === null ? null : differingPixels / (after.width * after.height) * 100 });
}
const report = { note: 'Pixel comparison excludes antialiasing and uses 0.1 threshold. Portrait/logo compression is an expected pixel difference; dimensions and visible layout require separate review.', comparisons };
if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
assert(comparisons.every(comparison => comparison.sameDimensions), 'Screenshot dimensions changed; inspect potential layout regression.');
