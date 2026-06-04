import type { UniverseCharacter } from '../types/universeGame';

const localPortraitExtensions = ['webp', 'png', 'jpg', 'jpeg'];

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugifyName(value: string): string {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addCandidate(candidates: string[], seen: Set<string>, value: string | null | undefined) {
  if (typeof value !== 'string') {
    return;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue || seen.has(normalizedValue)) {
    return;
  }

  seen.add(normalizedValue);
  candidates.push(normalizedValue);
}

export function getCharacterPortraitCandidates(
  character: Pick<UniverseCharacter, 'displayName' | 'portraitUrl'>,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const slug = slugifyName(character.displayName);

  addCandidate(candidates, seen, character.portraitUrl);

  for (const extension of localPortraitExtensions) {
    addCandidate(candidates, seen, `/images/GOTCharacterImages/${slug}.${extension}`);
  }

  return candidates;
}

export function getCharacterPortraitUrl(character: Pick<UniverseCharacter, 'displayName' | 'portraitUrl'>): string | null {
  return getCharacterPortraitCandidates(character)[0] ?? null;
}
