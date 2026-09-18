import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitFileError, maxPortraitBytes } from '../src/lib/adminCatalogCreation.ts';
import { catalogPayload, type CatalogColumn } from '../src/lib/adminCatalogTable.ts';

test('portrait selection accepts only bounded JPEG/PNG/WebP files', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(portraitFileError({ type, size: maxPortraitBytes }), null);
    assert.match(portraitFileError({ type, size: maxPortraitBytes + 1 })!, /5 MB/);
    assert.match(portraitFileError({ type, size: 0 })!, /non-empty/);
  }
  for (const type of ['image/svg+xml', 'image/gif', 'text/html', ''])
    assert.match(portraitFileError({ type, size: 100 })!, /JPEG/);
});

test('creation payload omits immutable IDs and edit versions', () => {
  const columns: CatalogColumn<{ id: number; name: string; portraitUrl: string | null }>[] = [
    { key: 'id', kind: 'readonly', label: 'ID', value: r => r.id },
    { key: 'name', kind: 'text', label: 'Name', value: r => r.name },
    { key: 'portraitUrl', kind: 'url', label: 'Portrait URL', optional: true, value: r => r.portraitUrl },
  ];
  assert.deepEqual(catalogPayload({ id: '50', name: 'New character', portraitUrl: '' }, columns), { name: 'New character', portraitUrl: null });
});
