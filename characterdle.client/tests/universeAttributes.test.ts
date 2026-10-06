import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareAttributeValue, formatAttributeValue } from '../src/lib/universeAttributes.ts';
import type { UniverseAttributeDefinition } from '../src/types/universeGame.ts';

const roles: UniverseAttributeDefinition = { key: 'occupation', label: 'Roles', kind: 'list', emptyLabel: 'ERROR' };

test('role hints and guess cells preserve the database order, including later admin changes', () => {
  const original = ['King', 'Lord Commander', "Night's Watch"];
  const reordered = ["Night's Watch", 'King', 'Lord Commander'];
  for (const values of [original, reordered]) {
    const expected = values.join(', ');
    assert.equal(formatAttributeValue(roles, values), expected);
    assert.deepEqual(compareAttributeValue(roles, values, original), { label: expected, tone: 'correct' });
  }
});

test('role comparisons ignore order without mutating either input array', () => {
  const current = ['Knight', 'Lord'];
  const answer = ['Lord', 'Knight'];
  assert.deepEqual(compareAttributeValue(roles, current, answer), { label: 'Knight, Lord', tone: 'correct' });
  assert.deepEqual(compareAttributeValue(roles, current, ['Knight']), { label: 'Knight, Lord', tone: 'partial' });
  assert.deepEqual(compareAttributeValue(roles, current, ['Queen']), { label: 'Knight, Lord', tone: 'neutral' });
  assert.deepEqual(current, ['Knight', 'Lord']);
  assert.deepEqual(answer, ['Lord', 'Knight']);
});
