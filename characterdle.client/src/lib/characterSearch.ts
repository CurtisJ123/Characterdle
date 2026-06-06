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

function getLastName(character: UniverseCharacter): string | null {
  const nameParts = normalizeSearchValue(character.displayName)
    .split(' ')
    .filter(Boolean);

  if (nameParts.length < 2) {
    return null;
  }

  return nameParts[nameParts.length - 1];
}

function lastNameStartsWith(character: UniverseCharacter, normalizedQuery: string): boolean {
  const lastName = getLastName(character);

  return lastName !== null && lastName.startsWith(normalizedQuery);
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
  const lastNameMatches: UniverseCharacter[] = [];

  for (const character of characters) {
    if (displayNameStartsWith(character, normalizedQuery)) {
      nameMatches.push(character);
      continue;
    }

    if (aliasStartsWith(character, normalizedQuery)) {
      aliasMatches.push(character);
      continue;
    }

    if (lastNameStartsWith(character, normalizedQuery)) {
      lastNameMatches.push(character);
    }
  }

  return [...nameMatches, ...aliasMatches, ...lastNameMatches];
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

  if (aliasPrefixMatches.length > 1) {
    return {
      character: null,
      reason: 'ambiguous',
    };
  }

  const lastNamePrefixMatches = characters.filter((character) => lastNameStartsWith(character, normalizedQuery));

  if (lastNamePrefixMatches.length === 1) {
    return {
      character: lastNamePrefixMatches[0],
      reason: 'match',
    };
  }

  return {
    character: null,
    reason: lastNamePrefixMatches.length > 1 ? 'ambiguous' : 'not_found',
  };
}
