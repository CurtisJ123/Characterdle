export function parseModerationGuests(text: string): string[] {
  const ids = text.split(/[\s,;]+/).filter(Boolean).map(id => id.replace(/^guest:/i, '').toLowerCase());
  if (ids.length > 20 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
    || id === '00000000-0000-0000-0000-000000000000')) throw new Error('Enter up to 20 guest UUIDs, one per line. The guest: prefix is optional.');
  if (new Set(ids).size !== ids.length) throw new Error('Each guest ID must appear only once.');
  return ids;
}
export const difficultyName = (level: number | null) => level ? ['Easy', 'Medium', 'Hard', 'Expert', 'Impossible'][level - 1] : '';
export const adminModeName = (mode: string) => mode === 'episode_ladder' ? 'Episode Ladder' : mode === 'quote' ? 'Quote' : 'Character';
