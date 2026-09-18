import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { catalogDraft, catalogPayload, selectCatalogRows, type CatalogColumn, type CatalogDraft } from '../../lib/adminCatalogTable';
import { catalogActionsColumn, catalogWidthsCookie, clampCatalogColumnWidth, readCatalogWidths } from '../../lib/adminCatalogWidths';
import { CatalogColumnResize } from './CatalogColumnResize';
import { CatalogCreateForm } from './CatalogCreateForm';
import { CatalogField } from './CatalogField';
import { updateMutation } from '../../services/announcementsApi';
import { UpdatesError } from '../updates/UpdatesCommon';
import './AdminCatalog.css';

export function EditableCatalogTable<Row extends { id: number; version: string }>({ title, token, path, initialRows, columns, refresh }: {
  title: string; token: string; path: string; initialRows: Row[]; columns: CatalogColumn<Row>[]; refresh: () => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string>('id');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('20');
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CatalogDraft>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const saveLock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const columnKeys = [...columns.map(column => column.key), catalogActionsColumn];
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try { return readCatalogWidths(document.cookie, path, columnKeys); }
    catch { return {}; }
  });
  const widthPreference = useRef({ path, keys: columnKeys, widths, changed: false });
  function persistWidths() {
    const preference = widthPreference.current;
    if (!preference.changed) return;
    try {
      const cookie = catalogWidthsCookie(preference.path, preference.widths, preference.keys, location.protocol === 'https:');
      if (cookie) document.cookie = cookie;
      preference.changed = false;
    } catch { /* Resizing still works when browser storage is unavailable. */ }
  }
  useEffect(() => () => persistWidths(), []);
  function resizeColumn(key: string, value: number) {
    const next = { ...widthPreference.current.widths, [key]: clampCatalogColumnWidth(key, value) };
    widthPreference.current.widths = next; widthPreference.current.changed = true;
    setWidths(next);
  }
  const columnWidth = (key: string, fallback: string) => `var(--catalog-width-${key}, var(--catalog-${fallback}-width))`;
  const sizes = columns.map(column => columnWidth(column.key, column.key === 'id' ? 'id' : column.wide ? 'wide' : 'default'));
  const actionsWidth = columnWidth(catalogActionsColumn, 'actions');
  const tableStyle = { ...Object.fromEntries(Object.entries(widths).map(([key, value]) => [`--catalog-width-${key}`, `${value}px`])),
    width: `calc(${[...sizes, actionsWidth].join(' + ')})` } as CSSProperties;
  function focusEdit(id: number) {
    requestAnimationFrame(() => form.current?.querySelector<HTMLButtonElement>(`button[aria-label="Edit row ${id}"]`)?.focus());
  }

  useEffect(() => {
    if (!editing) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: Event) => { if (busy || !window.confirm('Discard this unsaved row edit?')) event.preventDefault(); };
    const link = (event: MouseEvent) => {
      if ((event.target as Element).closest('a[href]:not([href^="#"])')) navigate(event);
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('characterdle:before-navigate', navigate);
    document.addEventListener('click', link, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('characterdle:before-navigate', navigate);
      document.removeEventListener('click', link, true);
    };
  }, [editing, busy]);

  const matched = selectCatalogRows(rows, columns, query, filters, sortKey, direction);
  const pageLength = pageSize === 'all' ? Math.max(1, matched.length) : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(matched.length / pageLength));
  const currentPage = Math.min(page, pageCount);
  const visible = matched.slice((currentPage - 1) * pageLength, currentPage * pageLength);
  function discard() {
    if (saveLock.current) return;
    if (editing) focusEdit(editing.id);
    setEditing(null); setDraft({}); setError(''); setNotice('');
  }
  async function save() {
    if (!editing || saveLock.current || !form.current?.reportValidity()) return;
    saveLock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const row = await updateMutation<Row>(`${path}/${editing.id}`, token, 'PUT', catalogPayload(draft, columns, editing.version));
      setRows(values => values.map(value => value.id === row.id ? row : value));
      setEditing(null); setDraft({}); setNotice(`Row #${row.id} saved.`);
      focusEdit(row.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save the row. Your changes are still here.'); }
    finally { saveLock.current = false; setBusy(false); }
  }
  function editor(column: CatalogColumn<Row>) {
    if (column.kind === 'readonly') return editing!.id;
    return <CatalogField column={column} draft={draft} setDraft={setDraft} label={`${column.label} for row ${editing!.id}`} disabled={busy} />;
  }

  return <section className="glass-card admin-catalog" aria-label={title}>
    <div className="admin-catalog-heading"><div><h2>{title}</h2><p>Edits affect source data used by daily and archive games.</p></div>
      <div className="admin-catalog-heading-actions">
        <button className="secondary-button" disabled={!!editing || creating} onClick={refresh}>Refresh</button>
        <button className="primary-button" disabled={!!editing || creating} onClick={() => { setCreating(true); setNotice(''); setError(''); }}>
          Add {path.endsWith('/characters') ? 'character' : 'quote'}</button>
      </div></div>
    {creating && <CatalogCreateForm token={token} path={path} columns={columns} onCancel={() => setCreating(false)}
      onCreated={row => {
        setRows(values => [...values.filter(value => value.id !== row.id), row]); setCreating(false);
        setQuery(''); setFilters({}); setSortKey('id'); setDirection('desc'); setPage(1); setNotice(`Row #${row.id} added.`);
      }} />}
    <div className="admin-catalog-tools">
      <label>Search all fields<input type="search" value={query} disabled={!!editing} placeholder={`Search ${title.toLowerCase()}...`}
        onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <button className="secondary-button" disabled={!!editing || (!query && !Object.values(filters).some(Boolean))}
        onClick={() => { setQuery(''); setFilters({}); setPage(1); }}>Clear filters</button>
      <span role="status">{matched.length} of {rows.length} rows</span>
    </div>
    <UpdatesError message={error} />
    {notice && <p className="admin-catalog-notice" role="status">{notice}</p>}
    <form ref={form} onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="admin-catalog-scroll" role="region" aria-label={`${title} table, scroll horizontally for more fields`} tabIndex={0}>
        <table className="admin-catalog-table" style={tableStyle}>
          <caption className="admin-catalog-sr-only">{title}. Sort with column headings. Filter using the field below each heading.</caption>
          <colgroup>{columns.map((column, index) => <col key={column.key} style={{ width: sizes[index] }} />)}<col style={{ width: actionsWidth }} /></colgroup>
          <thead><tr>{columns.map(column => <th scope="col" key={column.key} className={column.wide ? 'admin-catalog-wide' : undefined}
            aria-sort={sortKey === column.key ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
            <button type="button" className="admin-catalog-sort" disabled={!!editing} onClick={() => {
              setSortKey(column.key); setDirection(sortKey === column.key && direction === 'asc' ? 'desc' : 'asc'); setPage(1);
            }}>{column.label}<span aria-hidden="true">{sortKey === column.key ? direction === 'asc' ? '\u2191' : '\u2193' : '\u2195'}</span></button>
            <input type="search" aria-label={`Filter ${column.label}`} placeholder="Filter..." value={filters[column.key] ?? ''} disabled={!!editing}
              onChange={event => { setFilters(values => ({ ...values, [column.key]: event.target.value })); setPage(1); }} />
            <CatalogColumnResize columnKey={column.key} label={column.label} width={widths[column.key]} onResize={resizeColumn} onCommit={persistWidths} />
          </th>)}<th scope="col" className="admin-catalog-actions">Actions
            <CatalogColumnResize columnKey={catalogActionsColumn} label="Actions" width={widths[catalogActionsColumn]} onResize={resizeColumn} onCommit={persistWidths} leftEdge />
          </th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} className={editing?.id === row.id ? 'admin-catalog-editing' : undefined}>
            {columns.map(column => <td key={column.key} className={column.wide ? 'admin-catalog-wide' : undefined}>
              {editing?.id === row.id ? editor(column) : column.value(row) ?? <span className="admin-catalog-empty">None</span>}
            </td>)}
            <td className="admin-catalog-actions">{editing?.id === row.id ? <div>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
              <button className="secondary-button" type="button" disabled={busy} onClick={discard}>Discard</button>
            </div> : <button type="button" className="secondary-button admin-catalog-edit" disabled={!!editing || creating}
              aria-label={`Edit row ${row.id}`} onClick={() => {
                setEditing(row); setDraft(catalogDraft(row, columns)); setError(''); setNotice('');
                requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('tbody input, tbody textarea, tbody select')?.focus());
              }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></button>}</td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <p className="admin-catalog-no-results">No matching rows.</p>}
      </div>
    </form>
    <div className="admin-catalog-pagination">
      <label className="admin-catalog-page-size">Rows per page
        <select value={pageSize} disabled={!!editing} onChange={event => { setPageSize(event.target.value); setPage(1); }}>
          {[10, 20, 50, 100].map(size => <option key={size} value={String(size)}>{size}</option>)}<option value="all">All</option>
        </select>
      </label>
      <span>Page {currentPage} of {pageCount}</span><div>
      <button className="secondary-button" disabled={!!editing || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <button className="secondary-button" disabled={!!editing || currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
    </div></div>
  </section>;
}
