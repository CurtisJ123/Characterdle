import type { UniverseCharacter } from '../types/universeGame';

const localPortraitOverrides: Record<string, string> = {
  'jon snow': '/images/GOTCharacterImages/jon-snow.png',
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getCharacterPortraitUrl(character: Pick<UniverseCharacter, 'displayName' | 'portraitUrl'>): string | null {
  if (typeof character.portraitUrl === 'string' && character.portraitUrl.trim()) {
    return character.portraitUrl.trim();
  }

  return localPortraitOverrides[normalizeName(character.displayName)] ?? null;
}
