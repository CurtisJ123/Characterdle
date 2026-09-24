import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCatalogRows } from '../src/lib/adminCatalogTable.ts';
import { playerColumns, playerDate } from '../src/lib/adminPlayersTable.ts';
import { catalogWidthsCookie, readCatalogWidths } from '../src/lib/adminCatalogWidths.ts';
import type { AdminPlayerProfile } from '../src/types/admin.ts';

const profile = (id: string, patch: Partial<AdminPlayerProfile> = {}): AdminPlayerProfile => ({
  id, displayName: 'Player', email: 'player@example.invalid', avatarUrl: null, createdAt: '2026-09-20T00:00:00Z',
  membership: 'Free', lastPlayedAt: null, currentStreak: 0, longestStreak: 0, characterAttempts: 0,
  characterWins: 0, characterWinRate: 0, characterAverageGuesses: null, quoteAttempts: 0, quoteWins: 0,
  quoteWinRate: 0, quoteAverageGuesses: null, ladderPoints: 0, ladderDaysPlayed: 0, ladderPointsPerDay: 0, ...patch,
});
const rows = [profile('bbb', { displayName: 'Arya', membership: 'Trial', ladderPoints: 100 }),
  profile('aaa', { displayName: 'Sansa', membership: 'Premium', characterWinRate: 50, ladderPoints: 20 }),
  profile('ccc', { displayName: '<script>alert(1)</script>', email: 'test@example.invalid', ladderPoints: 9, lastPlayedAt: '2026-09-22T11:00:00Z' })];
const select = (query = '', filters = {}, key = 'displayName', direction: 'asc'|'desc' = 'asc') =>
  selectCatalogRows(rows, playerColumns, query, filters, key, direction);

test('players search all fields and combine per-column filters without dropping zero-activity accounts', () => {
  assert.equal(select().length, 3);
  assert.equal(select('TEST@EXAMPLE')[0].id, 'ccc');
  assert.deepEqual(select('', { membership: 'Trial', displayName: 'arya' }).map(r=>r.id), ['bbb']);
  assert.equal(select('50%')[0].id, 'aaa');
  assert.equal(select('', { lastPlayedAt: 'Never' }).length, 2);
  assert.equal(select('2026-09-22')[0].id, 'ccc');
  assert.equal(select("'; DROP TABLE profiles;--").length, 0);
});

test('players sort numbers numerically, date columns chronologically, and missing values last', () => {
  assert.deepEqual(select('', {}, 'ladderPoints').map(r=>r.ladderPoints), [9,20,100]);
  assert.deepEqual(select('', {}, 'ladderPoints','desc').map(r=>r.ladderPoints), [100,20,9]);
  assert.deepEqual(select('', {}, 'lastPlayedAt','desc').map(r=>r.id), ['ccc','aaa','bbb']);
  assert.deepEqual(select('', {}, 'createdAt').map(r=>r.id), ['aaa','bbb','ccc']);
  assert.equal(playerDate('2026-09-20T20:00:00-04:00'), '2026-09-21 00:00 UTC');
  assert.equal(rows[0].id, 'bbb');
});

test('every displayed player metric supports sorting and filtering', () => {
  assert.equal(new Set(playerColumns.map(c=>c.key)).size, playerColumns.length);
  for(const column of playerColumns) {
    assert.equal(select('', {}, column.key).length, 3);
    const needle = column.search?.(rows[0]) ?? String(column.value(rows[0]) ?? '');
    assert.ok(select('', { [column.key]: needle }).some(r=>r.id === rows[0].id));
  }
});

test('player column cookies contain widths only, isolated from editable catalog preferences', () => {
  const keys=playerColumns.map(c=>c.key);
  const cookie=catalogWidthsCookie('/api/admin/players',{ displayName:330, email:400 },keys,true)!;
  assert.deepEqual(readCatalogWidths(cookie,'/api/admin/players',keys),{ displayName:330, email:400 });
  assert.deepEqual(readCatalogWidths(cookie,'/api/admin/got/characters',keys),{});
  assert.doesNotMatch(cookie,/example|password|token|Premium/);
});
