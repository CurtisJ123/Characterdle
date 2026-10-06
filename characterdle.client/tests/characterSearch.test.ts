import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOrderedCharacterPrefixMatches, getSuggestedCharacterGuess, resolveCharacterSearch } from '../src/lib/characterSearch.ts';
import type { UniverseCharacter } from '../src/types/universeGame.ts';

const character = (id: number, displayName: string, aliases: string[] = []): UniverseCharacter =>
  ({ id, displayName, aliases, attributes: {}, portraitUrl: null });
const characters = [
  character(1, 'Eddard Stark', ['Ned']),
  character(2, 'Eddison Tollett', ['Edd', 'Dolorous Edd']),
  character(3, 'Jon Snow', ['Lord Snow']),
  character(4, 'Robb Stark', ['Young Wolf']),
];

test('Enter uses the first displayed prefix instead of an exact alias further down the dropdown', () => {
  assert.deepEqual(getOrderedCharacterPrefixMatches(characters, 'EDD').map(c => c.id), [1, 2]);
  assert.equal(resolveCharacterSearch('EDD', characters).character?.id, 2);
  const guess = getSuggestedCharacterGuess('EDD', characters);
  assert.equal(guess, 'Eddard Stark');
  assert.equal(resolveCharacterSearch(guess, characters).character?.id, 1);
});

test('submission and suggestions agree for names, aliases, surnames, and whitespace/case variations', () => {
  for (const query of [' eDd ', 'Eddison', '  EDDARD   STARK ', 'Ned', 'Dolorous', 'Snow', 'Stark', 'Young']) {
    const first = getOrderedCharacterPrefixMatches(characters, query)[0];
    assert.ok(first);
    assert.equal(resolveCharacterSearch(getSuggestedCharacterGuess(query, characters), characters).character?.id, first.id);
  }
});

test('already-guessed characters are excluded when picking the next suggestion', () => {
  const available = characters.filter(c => c.id !== 1);
  assert.equal(getSuggestedCharacterGuess('EDD', available), 'Eddison Tollett');
  assert.deepEqual(characters.map(c => c.id), [1, 2, 3, 4]);
});

test('the latest input is resolved even if a previous dropdown render used an older query', () => {
  assert.equal(getOrderedCharacterPrefixMatches(characters, 'Edd')[0].id, 1);
  assert.equal(getSuggestedCharacterGuess('Eddison', characters), 'Eddison Tollett');
});

test('blank or unmatched input retains existing no-match validation rather than guessing someone', () => {
  for (const query of ['', '   ', 'Not a character']) {
    assert.equal(getSuggestedCharacterGuess(query, characters), query);
    assert.equal(resolveCharacterSearch(getSuggestedCharacterGuess(query, characters), characters).reason, 'not_found');
  }
  assert.equal(getSuggestedCharacterGuess('EDD', []), 'EDD');
});

test('inactive characters cannot be suggested or submitted by name, alias, or surname', () => {
  const inactive = { ...character(345, 'Little Sam', ['Sammy']), canGuess: false };
  const catalog = [...characters, inactive];
  for (const query of ['Little Sam', 'Little', 'Sammy', 'Sam']) {
    assert.deepEqual(getOrderedCharacterPrefixMatches(catalog, query), []);
    assert.equal(resolveCharacterSearch(query, catalog).reason, 'not_found');
  }
  assert.equal(catalog.find(c => c.id === 345), inactive); // Still available to render saved guesses.
});

test('historically eligible inactive characters are searchable like every other character', () => {
  const historical = { ...character(345, 'Little Sam', ['Sammy']), canGuess: true };
  assert.equal(getOrderedCharacterPrefixMatches([historical], 'Sam')[0].id, 345);
  assert.equal(resolveCharacterSearch('Sammy', [historical]).character?.id, 345);
});

test('an inactive exact alias cannot shadow a selectable character', () => {
  const catalog = [{ ...character(345, 'Little Sam', ['Jon']), canGuess: false }, ...characters];
  assert.equal(resolveCharacterSearch('Jon', catalog).character?.id, 3);
});
