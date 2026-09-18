import assert from 'node:assert/strict';
import test from 'node:test';
import { insertPostImage, safePostImageUrl, safePostUrl } from '../src/lib/postMarkdown.ts';
import { buildRoutePath } from '../src/lib/routePaths.ts';

test('update and admin paths do not inherit game state', () => {
  const route = { authMode: 'login', universeId: 'got', gameId: 50, gameMode: 'quote' } as const;
  assert.equal(buildRoutePath({ ...route, page: 'updates' }), '/updates');
  assert.equal(buildRoutePath({ ...route, page: 'updates', postSlug: 'new-mode' }), '/updates/new-mode');
  assert.equal(buildRoutePath({ ...route, page: 'admin' }), '/admin');
});

test('Markdown allows ordinary website, contact, and internal links', () => {
  for (const url of ['https://characterdle.com/got', 'http://example.com', 'mailto:support@characterdle.com', '/updates', '#rules']) {
    assert.equal(safePostUrl(url), url);
  }
});

test('Markdown rejects executable URLs and browser URL normalization tricks', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,script', '//evil.example',
    '/\\evil.example', 'java\nscript:alert(1)', 'https:\\evil.example', 'vbscript:msgbox(1)', 'file:///private', '\u0000javascript:alert(1)']) {
    assert.equal(safePostUrl(url), '', url);
  }
});

test('Markdown images accept HTTPS and site paths, not executable, insecure, or contact URLs', () => {
  for (const url of ['https://storage.example/image.png', '/images/test.png']) assert.equal(safePostImageUrl(url), url);
  for (const url of ['http://example.com/image.png', 'mailto:user@example.com', '#anchor', '//example.com/a.png',
    'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'blob:https://example.com/id', '/\\evil.example']) assert.equal(safePostImageUrl(url), '');
});

test('image insertion preserves surrounding Markdown and escapes description syntax', () => {
  const result = insertPostImage('before selected after', 7, 15, 'Map [north] *test*', 'https://storage.example/map.png');
  assert.equal(result.content, 'before \n\n![Map \\[north\\] \\*test\\*](<https://storage.example/map.png>)\n\n after');
  assert.equal(result.content.slice(result.cursor), ' after');
  assert.throws(() => insertPostImage('', 0, 0, '', '/map.png'));
  assert.throws(() => insertPostImage('', 0, 0, 'Map', 'javascript:alert(1)'));
  assert.throws(() => insertPostImage('x'.repeat(100000), 0, 0, 'Map', '/map.png'));
});
