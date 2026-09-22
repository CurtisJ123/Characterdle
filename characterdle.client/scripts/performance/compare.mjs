import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [beforePath, afterPath, outputPath] = process.argv.slice(2);
assert(beforePath && afterPath, 'Usage: node scripts/performance/compare.mjs BEFORE/report.json AFTER/report.json [comparison.md]');
const before = JSON.parse(await readFile(beforePath, 'utf8'));
const after = JSON.parse(await readFile(afterPath, 'utf8'));
assert.equal(before.failure, null, 'Baseline run failed.');
assert.equal(after.failure, null, 'After run failed.');
assert.equal(before.browserVersion, after.browserVersion, 'Use the same browser version.');
assert.deepEqual(before.settings, after.settings, 'Use identical throttling and run settings.');
const ms = value => `${Math.round(value)} ms`;
const kib = value => `${(value / 1024).toFixed(1)} KiB`;
const delta = (previous, current) => `${((current / previous - 1) * 100).toFixed(1)}%`;
const lines = ['# Before / After Frontend Benchmark', '',
  'Medians from identical isolated local mobile runs. Negative percentages are reductions.', '',
  '| Scenario | Transfer before -> after | Change | JS before -> after | CSS before -> after | Ready before -> after |',
  '| --- | --- | ---: | --- | --- | --- |'];
for (const baseline of before.summary) {
  const current = after.summary.find(row => row.scenario === baseline.scenario);
  assert(current && current.samples === baseline.samples && current.samples >= 3, 'Need at least 3 matching samples per scenario.');
  lines.push(`| ${baseline.scenario} | ${kib(baseline.bytes.total)} -> ${kib(current.bytes.total)} | ${delta(baseline.bytes.total, current.bytes.total)} | ${kib(baseline.bytes.js)} -> ${kib(current.bytes.js)} | ${kib(baseline.bytes.css)} -> ${kib(current.bytes.css)} | ${ms(baseline.readyMs)} -> ${ms(current.readyMs)} |`);
}
lines.push('', '| Scenario | FCP before -> after | LCP before -> after | CLS before -> after |', '| --- | --- | --- | --- |');
for (const baseline of before.summary) {
  const current = after.summary.find(row => row.scenario === baseline.scenario);
  lines.push(`| ${baseline.scenario} | ${ms(baseline.fcpMs)} -> ${ms(current.fcpMs)} | ${ms(baseline.lcpMs)} -> ${ms(current.lcpMs)} | ${baseline.cls.toFixed(4)} -> ${current.cls.toFixed(4)} |`);
}
lines.push('', '## Method and Scope', ...before.limitations.map(value => `- ${value}`), '',
  `Browser: ${before.browserVersion}. ${before.settings.runs} runs at ${before.settings.viewport.width}x${before.settings.viewport.height}, ${before.settings.cpuSlowdown}x CPU, ${before.settings.latencyMs}ms latency, ${before.settings.observationMs / 1000}s fixed observation window.`, '',
  `Before build manifest SHA256: ${before.manifestSha256}`, `After build manifest SHA256: ${after.manifestSha256}`, '');
const markdown = lines.join('\n');
if (outputPath) await writeFile(path.resolve(outputPath), markdown);
console.log(markdown);
