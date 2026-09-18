import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogActionsColumn, catalogWidthsCookie, readCatalogWidths, clampCatalogColumnWidth } from '../src/lib/adminCatalogWidths.ts';

const characters = '/api/admin/got/characters', quotes = '/api/admin/got/quotes';
const keys = ['id', 'displayName', 'aliases', catalogActionsColumn];

test('column preferences round-trip per table with a host-only one-year cookie', () => {
  const cookie = catalogWidthsCookie(characters, { id: 95, displayName: 340, __actions: 130 }, keys, true)!;
  assert.deepEqual(readCatalogWidths(`other=value; ${cookie.split(';')[0]}`, characters, keys), { id: 95, displayName: 340, __actions: 130 });
  assert.deepEqual(readCatalogWidths(cookie, quotes, keys), {});
  assert.match(cookie, /Max-Age=31536000; SameSite=Lax; Secure$/);
  assert.doesNotMatch(cookie, /Domain=|token|userId/);
});

test('malformed, non-object, oversized and missing cookies safely use defaults', () => {
  for (const value of ['', '%oops', 'null', '[]', '123', '%7Bbad%7D', 'x'.repeat(4097)])
    assert.deepEqual(readCatalogWidths(`characterdle_admin_characters_columns_v1=${value}`, characters, keys), {});
  assert.deepEqual(readCatalogWidths('someothercookie=123', characters, keys), {});
});

test('untrusted widths are bounded and unknown or nonnumeric fields are ignored', () => {
  const value = encodeURIComponent(JSON.stringify({ id: -10, displayName: 100000, aliases: '250', __actions: 143.6, secret: 999 }));
  assert.deepEqual(readCatalogWidths(`characterdle_admin_characters_columns_v1=${value}`, characters, keys), { id: 64, displayName: 1000, __actions: 144 });
  assert.equal(clampCatalogColumnWidth('displayName', 30), 100);
  assert.equal(clampCatalogColumnWidth('__actions', 30), 92);
});

test('serialization only includes allowed finite widths and supports local HTTP', () => {
  const cookie = catalogWidthsCookie(characters, { id: Infinity, aliases: NaN, displayName: 280, unknown: 160 }, keys, false)!;
  assert.deepEqual(readCatalogWidths(cookie, characters, keys), { displayName: 280 });
  assert.doesNotMatch(cookie, /Secure/);
  assert.equal(catalogWidthsCookie('/other', {}, keys, true), null);
});
