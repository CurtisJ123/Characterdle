import { useRef, useState, type CSSProperties } from 'react';
import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import { selectCatalogRows } from '../../lib/adminCatalogTable';
import { catalogWidthsCookie, clampCatalogColumnWidth, readCatalogWidths } from '../../lib/adminCatalogWidths';
import { playerColumns, playerDate } from '../../lib/adminPlayersTable';
import type { AdminPlayerProfile } from '../../types/admin';
import { UserAvatar } from '../ui/UserAvatar';
import { UpdatesError } from '../updates/UpdatesCommon';
import { CatalogColumnResize } from './CatalogColumnResize';
import './AdminCatalog.css';
import './AdminPlayers.css';

const path = '/api/admin/players';
const keys = playerColumns.map(c => c.key);

export function AdminPlayers({ token }: { token: string }) {
  const result = useUpdatesResource<AdminPlayerProfile[]>(path, token);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('20');
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try { return readCatalogWidths(document.cookie, path, keys); } catch { return {}; }
  });
  const pendingWidths = useRef(widths);
  function resize(key: string, width: number) {
    pendingWidths.current = { ...pendingWidths.current, [key]: clampCatalogColumnWidth(key, width) };
    setWidths(pendingWidths.current);
  }
  function persistWidths() {
    try {
      const cookie = catalogWidthsCookie(path, pendingWidths.current, keys, location.protocol === 'https:');
      if (cookie) document.cookie = cookie;
    } catch { /* Keep the table usable if cookies are blocked. */ }
  }
  const matched = selectCatalogRows(result.data ?? [], playerColumns, query, filters, sortKey, direction);
  const pageLength = pageSize === 'all' ? Math.max(1, matched.length) : Number(pageSize);
  const pages = Math.max(1, Math.ceil(matched.length / pageLength));
  const currentPage = Math.min(page, pages);
  const visible = matched.slice((currentPage - 1) * pageLength, currentPage * pageLength);
  const sizes = playerColumns.map(c => widths[c.key] ?? (c.wide ? 274 : 180));
  const tableStyle = { width: sizes.reduce((sum, width) => sum + width, 0) } as CSSProperties;
  function cell(row: AdminPlayerProfile, key: typeof keys[number]) {
    if (key === 'displayName') return <div className="admin-player-name"><UserAvatar displayName={row.displayName} avatarUrl={row.avatarUrl}
      isPremium={row.membership !== 'Free'} /><strong>{row.displayName}</strong></div>;
    if (key === 'membership') return <span className={`admin-membership admin-membership--${row.membership.toLowerCase()}`}>{row.membership}</span>;
    if (key === 'createdAt' || key === 'lastPlayedAt') return row[key] ? <time dateTime={row[key]}>{playerDate(row[key])}</time> : <span className="admin-catalog-empty">Never</span>;
    if (key === 'characterWinRate' || key === 'quoteWinRate') return `${row[key]}%`;
    const value = row[key];
    return value ?? <span className="admin-catalog-empty">None</span>;
  }
  return <section className="glass-card admin-catalog admin-players" aria-label="Player profiles">
    <div className="admin-catalog-heading"><div><h2>Players</h2><p>All profiles, with Game of Thrones stats. Read-only.</p></div>
      <button className="secondary-button" disabled={result.loading} onClick={result.reload}>Refresh</button></div>
    <div className="admin-catalog-tools">
      <label>Search all fields<input type="search" placeholder="Search players..." value={query}
        onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <button className="secondary-button" disabled={!query && !Object.values(filters).some(Boolean)}
        onClick={() => { setQuery(''); setFilters({}); setPage(1); }}>Clear filters</button>
      {result.data && <span role="status">{matched.length} of {result.data.length} players</span>}
    </div>
    <UpdatesError message={result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading players...</p>}
    {result.data && <>
      <div className="admin-catalog-scroll" role="region" aria-label="Players table, scroll horizontally for more stats" tabIndex={0}>
        <table className="admin-catalog-table" style={tableStyle}>
          <caption className="admin-catalog-sr-only">Player profiles. Sort by column headings and search each field below its heading.</caption>
          <colgroup>{playerColumns.map((c, index) => <col key={c.key} style={{ width: sizes[index] }} />)}</colgroup>
          <thead><tr>{playerColumns.map(c => <th scope="col" key={c.key} aria-sort={sortKey === c.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
            <button type="button" className="admin-catalog-sort" onClick={() => {
              setSortKey(c.key); setDirection(sortKey === c.key && direction === 'asc' ? 'desc' : 'asc'); setPage(1);
            }}>{c.label}<span aria-hidden="true">{sortKey === c.key ? direction === 'asc' ? '\u2191' : '\u2193' : '\u2195'}</span></button>
            <input type="search" aria-label={`Filter ${c.label}`} placeholder="Filter..." value={filters[c.key] ?? ''}
              onChange={event => { setFilters(values => ({ ...values, [c.key]: event.target.value })); setPage(1); }} />
            <CatalogColumnResize columnKey={c.key} label={c.label} width={widths[c.key]} onResize={resize} onCommit={persistWidths} />
          </th>)}</tr></thead>
          <tbody>{visible.map(row => <tr key={row.id}>{playerColumns.map(c => <td key={c.key}>{cell(row, c.key)}</td>)}</tr>)}</tbody>
        </table>
        {!visible.length && <p className="admin-catalog-no-results">No matching players.</p>}
      </div>
      <div className="admin-catalog-pagination"><label className="admin-catalog-page-size">Rows per page
        <select value={pageSize} onChange={event => { setPageSize(event.target.value); setPage(1); }}>
          {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}<option value="all">All</option>
        </select></label><span>Page {currentPage} of {pages}</span><div>
          <button className="secondary-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <button className="secondary-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div></div>
    </>}
    <p className="admin-player-definitions">Attempts include completed games with hints, give-ups, and preserved replays. Wins and average guesses exclude hints.
      Ladder days count dates with at least one completed difficulty, including losses. Last played is saved gameplay activity, not last sign-in.</p>
  </section>;
}
