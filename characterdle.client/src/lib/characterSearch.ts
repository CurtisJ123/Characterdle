import type { UniverseCharacter } from '../types/universeGame';

export interface CharacterSearchMatchResult {
  character: UniverseCharacter | null;
  reason: 'match' | 'not_found' | 'ambiguous';
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function displayNameStartsWith(character: UniverseCharacter, normalizedQuery: string): boolean {
  return normalizeSearchValue(character.displayName).startsWith(normalizedQuery);
}

function aliasStartsWith(character: UniverseCharacter, normalizedQuery: string): boolean {
  return character.aliases.some((alias) => normalizeSearchValue(alias).startsWith(normalizedQuery));
}

export function getOrderedCharacterPrefixMatches(
  characters: UniverseCharacter[],
  query: string,
): UniverseCharacter[] {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return [];
  }

  const nameMatches: UniverseCharacter[] = [];
  const aliasMatches: UniverseCharacter[] = [];

  for (const character of characters) {
    if (displayNameStartsWith(character, normalizedQuery)) {
      nameMatches.push(character);
      continue;
    }

    if (aliasStartsWith(character, normalizedQuery)) {
      aliasMatches.push(character);
    }
  }

  return [...nameMatches, ...aliasMatches];
}

export function resolveCharacterSearch(
  query: string,
  characters: UniverseCharacter[],
): CharacterSearchMatchResult {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return {
      character: null,
      reason: 'not_found',
    };
  }

  const exactMatches = characters.filter((character) => [
    character.displayName,
    ...character.aliases,
  ].some((value) => normalizeSearchValue(value) === normalizedQuery));

  if (exactMatches.length === 1) {
    return {
      character: exactMatches[0],
      reason: 'match',
    };
  }

  if (exactMatches.length > 1) {
    return {
      character: null,
      reason: 'ambiguous',
    };
  }

  const namePrefixMatches = characters.filter((character) => displayNameStartsWith(character, normalizedQuery));

  if (namePrefixMatches.length === 1) {
    return {
      character: namePrefixMatches[0],
      reason: 'match',
    };
  }

  if (namePrefixMatches.length > 1) {
    return {
      character: null,
      reason: 'ambiguous',
    };
  }

  const aliasPrefixMatches = characters.filter((character) => aliasStartsWith(character, normalizedQuery));

  if (aliasPrefixMatches.length === 1) {
    return {
      character: aliasPrefixMatches[0],
      reason: 'match',
    };
  }

  return {
    character: null,
    reason: aliasPrefixMatches.length > 1 ? 'ambiguous' : 'not_found',
  };
}
