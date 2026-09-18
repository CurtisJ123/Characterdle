import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import type { CatalogColumn } from '../../lib/adminCatalogTable';
import type { AdminCatalogOptions, AdminCharacter, AdminQuote } from '../../types/adminCatalog';
import { UpdatesError } from '../updates/UpdatesCommon';
import { EditableCatalogTable } from './EditableCatalogTable';

const characters: CatalogColumn<AdminCharacter>[] = [
  { key: 'id', label: 'ID', kind: 'readonly', value: r => r.id },
  { key: 'displayName', label: 'Name', kind: 'text', maxLength: 200, value: r => r.displayName, wide: true },
  { key: 'aliases', label: 'Aliases', kind: 'list', value: r => r.aliases.join('\n') || null, wide: true },
  { key: 'gender', label: 'Gender', kind: 'text', maxLength: 100, value: r => r.gender },
  { key: 'species', label: 'Species', kind: 'text', maxLength: 100, value: r => r.species },
  { key: 'house', label: 'Houses', kind: 'list', value: r => r.house.join('\n') || null, wide: true },
  { key: 'occupation', label: 'Roles', kind: 'list', value: r => r.occupation.join('\n') || null, wide: true },
  { key: 'debutSeason', label: 'Debut season', kind: 'number', min: 0, max: 8, value: r => r.debutSeason },
  { key: 'lastSeason', label: 'Last season', kind: 'number', min: 0, max: 8, value: r => r.lastSeason },
  { key: 'alive', label: 'Status', kind: 'boolean', value: r => r.alive ? 'Alive' : 'Dead' },
  { key: 'portraitUrl', label: 'Portrait URL', kind: 'url', optional: true, maxLength: 2048, value: r => r.portraitUrl, wide: true },
];

function quoteColumns(options: AdminCatalogOptions): CatalogColumn<AdminQuote>[] {
  const name = (id: number) => options.characters.find(row => row.id === id)?.displayName ?? `Unknown #${id}`;
  const title = (id: number | null) => options.episodes.find(row => row.id === id)?.title ?? null;
  return [
    { key: 'id', label: 'ID', kind: 'readonly', value: r => r.id },
    { key: 'quoteText', label: 'Quote', kind: 'multiline', maxLength: 10000, wide: true, value: r => r.quoteText },
    { key: 'characterId', label: 'Character', kind: 'select', wide: true, value: r => name(r.characterId),
      search: r => `${name(r.characterId)} ${r.characterId}`,
      options: () => options.characters.map(row => ({ value: String(row.id), label: `${row.displayName} (#${row.id})` })) },
    { key: 'seasonNumber', label: 'Season', kind: 'number', min: 1, max: 8, value: r => r.seasonNumber },
    { key: 'episodeNumber', label: 'Episode', kind: 'number', min: 1, max: 10, value: r => r.episodeNumber },
    { key: 'episodeTitleId', label: 'Episode title', kind: 'select', optional: true, wide: true, value: r => title(r.episodeTitleId),
      search: r => `${title(r.episodeTitleId) ?? 'None'} ${r.episodeTitleId ?? ''}`,
      change: (draft, value) => {
        const episode = options.episodes.find(row => String(row.id) === value);
        return { ...draft, episodeTitleId: value, ...(episode ? { seasonNumber: String(episode.seasonNumber), episodeNumber: String(episode.episodeNumber) } : {}) };
      },
      options: () => options.episodes.map(row => ({ value: String(row.id), label: `S${row.seasonNumber} E${row.episodeNumber}: ${row.title} (#${row.id})` })) },
  ];
}

export function AdminCharacters({ token }: { token: string }) {
  const result = useUpdatesResource<AdminCharacter[]>('/api/admin/got/characters', token);
  return <><UpdatesError message={result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading characters...</p>}
    {result.data && <EditableCatalogTable title="GOT Characters" token={token} path="/api/admin/got/characters"
      initialRows={result.data} columns={characters} refresh={result.reload} />}</>;
}

export function AdminQuotes({ token }: { token: string }) {
  const result = useUpdatesResource<AdminQuote[]>('/api/admin/got/quotes', token);
  const options = useUpdatesResource<AdminCatalogOptions>('/api/admin/got/options', token);
  function refresh() { result.reload(); options.reload(); }
  return <><UpdatesError message={result.error || options.error} retry={refresh} />
    {(result.loading || options.loading) && <p role="status">Loading quotes...</p>}
    {result.data && options.data && <EditableCatalogTable title="GOT Quotes" token={token} path="/api/admin/got/quotes"
      initialRows={result.data} columns={quoteColumns(options.data)} refresh={refresh} />}</>;
}
