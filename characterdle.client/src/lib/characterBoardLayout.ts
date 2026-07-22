import type { UniverseAttributeDefinition } from '../types/universeGame';

const IDENTITY_GROUP_KEY = 'species-gender';
const IDENTITY_ATTRIBUTE_ORDER = ['species', 'gender'] as const;
const IDENTITY_ATTRIBUTE_KEYS = new Set<string>(IDENTITY_ATTRIBUTE_ORDER);

export interface CharacterBoardAttributeEntry {
  definition: UniverseAttributeDefinition;
  index: number;
}

export interface CharacterBoardAttributeGroup {
  entries: CharacterBoardAttributeEntry[];
  key: string;
  kind: 'attribute' | 'identity';
  label: string;
}

function normalizeAttributeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function getCharacterBoardAttributeGroups(
  definitions: UniverseAttributeDefinition[],
): CharacterBoardAttributeGroup[] {
  const identityEntries = IDENTITY_ATTRIBUTE_ORDER
    .map((key) => {
      const index = definitions.findIndex(
        (definition) => normalizeAttributeKey(definition.key) === key,
      );

      return index >= 0
        ? { definition: definitions[index], index }
        : null;
    })
    .filter((entry): entry is CharacterBoardAttributeEntry => entry !== null);

  if (identityEntries.length !== IDENTITY_ATTRIBUTE_ORDER.length) {
    return definitions.map((definition, index) => ({
      entries: [{ definition, index }],
      key: definition.key,
      kind: 'attribute' as const,
      label: definition.label,
    }));
  }

  const firstIdentityIndex = Math.min(...identityEntries.map((entry) => entry.index));

  return definitions.flatMap<CharacterBoardAttributeGroup>((definition, index) => {
    const normalizedKey = normalizeAttributeKey(definition.key);

    if (IDENTITY_ATTRIBUTE_KEYS.has(normalizedKey)) {
      return index === firstIdentityIndex
        ? [{ entries: identityEntries, key: IDENTITY_GROUP_KEY, kind: 'identity' as const, label: 'Identity' }]
        : [];
    }

    return [{
      entries: [{ definition, index }],
      key: definition.key,
      kind: 'attribute' as const,
      label: definition.label,
    }];
  });
}

export function getCharacterBoardAttributeColumnCount(
  definitions: UniverseAttributeDefinition[],
): number {
  return getCharacterBoardAttributeGroups(definitions).length;
}

export function getMobileAttributeLabel(
  definition: UniverseAttributeDefinition,
  label: string,
): string | undefined {
  if (normalizeAttributeKey(definition.key) !== 'house') {
    return undefined;
  }

  return label
    .split(',')
    .map((value) => value.trim().replace(/^House\s+/i, ''))
    .join(', ');
}
