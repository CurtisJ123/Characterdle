import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogDraft, catalogPayload, selectCatalogRows, type CatalogColumn } from '../src/lib/adminCatalogTable.ts';

const rows = [
  { id: 10, name: 'Arya Stark', season: 8, alive: true, aliases: ['No One', 'Arry'], portrait: null },
  { id: 2, name: 'Jon Snow', season: 2, alive: true, aliases: [], portrait: '/images/jon.png' },
  { id: 3, name: 'Ned Stark', season: 1, alive: false, aliases: [], portrait: null },
];
type Row = typeof rows[number];
const columns: CatalogColumn<Row>[] = [
  { key: 'id', label: 'ID', kind: 'readonly', value: r => r.id },
  { key: 'name', label: 'Name', kind: 'text', value: r => r.name },
  { key: 'season', label: 'Season', kind: 'number', value: r => r.season },
  { key: 'alive', label: 'Status', kind: 'boolean', value: r => r.alive ? 'Alive' : 'Dead' },
  { key: 'aliases', label: 'Aliases', kind: 'list', value: r => r.aliases.join('\n') },
  { key: 'portrait', label: 'Portrait', kind: 'url', optional: true, value: r => r.portrait },
];

test('catalog sorts numeric IDs and seasons numerically without changing source data', () => {
  assert.deepEqual(selectCatalogRows(rows, columns, '', {}, 'id', 'asc').map(r => r.id), [2, 3, 10]);
  assert.deepEqual(selectCatalogRows(rows, columns, '', {}, 'season', 'desc').map(r => r.id), [10, 2, 3]);
  assert.deepEqual(rows.map(r => r.id), [10, 2, 3]);
});
test('global search and individual field filters combine, ignoring case and outer whitespace', () => {
  assert.deepEqual(selectCatalogRows(rows, columns, ' STARk ', { alive: 'alive', season: '8' }, 'name', 'asc').map(r => r.id), [10]);
  assert.deepEqual(selectCatalogRows(rows, columns, 'arry', {}, 'name', 'asc').map(r => r.id), [10]);
  assert.equal(selectCatalogRows(rows, columns, 'missing', {}, 'name', 'asc').length, 0);
});
test('every visible metric can be searched and nullable fields sort last', () => {
  for (const [field, value, id] of [['id', '10', 10], ['name', 'jon', 2], ['season', '1', 3], ['alive', 'dead', 3], ['aliases', 'No One', 10], ['portrait', 'jon.png', 2]] as const)
    assert.deepEqual(selectCatalogRows(rows, columns, '', { [field]: value }, 'id', 'asc').map(r => r.id), [id]);
  assert.equal(selectCatalogRows(rows, columns, '', {}, 'portrait', 'desc')[0].id, 2);
});
test('editor preserves lists, booleans, nulls, and immutable IDs/versions correctly', () => {
  const draft = catalogDraft(rows[0], columns);
  assert.equal(draft.aliases, 'No One\nArry');
  const payload = catalogPayload({ ...draft, name: 'Arya', aliases: 'No One\n\n Arry ', alive: 'false', portrait: '' }, columns, '123');
  assert.deepEqual(payload, { expectedVersion: '123', name: 'Arya', aliases: ['No One', 'Arry'], alive: false, season: 8, portrait: null });
  assert.equal('id' in payload, false);
  assert.equal(rows[0].name, 'Arya Stark');
});
test('invalid numeric edits are not converted to zero or silently rounded', () => {
  const draft = catalogDraft(rows[0], columns);
  for (const season of ['', '1.5', 'wat', '9007199254740992'])
    assert.throws(() => catalogPayload({ ...draft, season }, columns, '123'), /whole number/);
});
test('quote foreign key selections remain numeric, including optional null references', () => {
  const fields: CatalogColumn<{ characterId: number; episodeTitleId: number | null }>[] = [
    { key: 'characterId', label: 'Character', kind: 'select', value: r => r.characterId },
    { key: 'episodeTitleId', label: 'Episode title', kind: 'select', optional: true, value: r => r.episodeTitleId },
  ];
  assert.deepEqual(catalogPayload({ characterId: '3', episodeTitleId: '' }, fields, '5'), { characterId: 3, episodeTitleId: null, expectedVersion: '5' });
});
