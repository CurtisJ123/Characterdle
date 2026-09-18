import { useEffect, useRef, useState } from 'react';
import { catalogPayload, type CatalogColumn, type CatalogDraft } from '../../lib/adminCatalogTable';
import { encodePortrait, portraitFileError } from '../../lib/adminCatalogCreation';
import { updateMutation } from '../../services/announcementsApi';
import { UpdatesError } from '../updates/UpdatesCommon';
import { CatalogField } from './CatalogField';

export function CatalogCreateForm<Row extends { id: number; version: string }>({ token, path, columns, onCreated, onCancel }: {
  token: string; path: string; columns: CatalogColumn<Row>[]; onCreated: (row: Row) => void; onCancel: () => void;
}) {
  const character = path === '/api/admin/got/characters';
  const [draft, setDraft] = useState<CatalogDraft>((): CatalogDraft => character
    ? { species: 'Human', house: 'Lowborn', debutSeason: '1', lastSeason: '1' }
    : { seasonNumber: '1', episodeNumber: '1' });
  const [portrait, setPortrait] = useState<{ file: File; url: string } | null>(null);
  const previewUrl = useRef<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    form.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigate = (event: Event) => { if (lock.current || !window.confirm('Discard this unsaved entry?')) event.preventDefault(); };
    const link = (event: MouseEvent) => { if ((event.target as Element).closest('a[href]:not([href^="#"])')) navigate(event); };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('characterdle:before-navigate', navigate);
    document.addEventListener('click', link, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('characterdle:before-navigate', navigate);
      document.removeEventListener('click', link, true);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function selectPortrait(file: File | null) {
    if (lock.current) return;
    if (file && portraitFileError(file)) { setError(portraitFileError(file)!); if (fileInput.current) fileInput.current.value = ''; return; }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewUrl.current = url;
    setPortrait(file && url ? { file, url } : null); setError('');
    if (file) setDraft(values => ({ ...values, portraitUrl: '' }));
    if (!file && fileInput.current) fileInput.current.value = '';
  }

  async function save() {
    if (lock.current || !form.current?.reportValidity()) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const fields = catalogPayload(draft, columns);
      const body = character ? { requestId, character: fields, ...(portrait ? { portrait: await encodePortrait(portrait.file) } : {}) }
        : { requestId, quote: fields };
      const row = await updateMutation<Row>(path, token, 'POST', body);
      onCreated(row);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Your entry is still here.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return <form className="admin-catalog-create" ref={form} onSubmit={event => { event.preventDefault(); void save(); }}>
    <h3>Add {character ? 'character' : 'quote'}</h3>
    <div className="admin-catalog-create-fields">
      {columns.filter(column => column.kind !== 'readonly' && !(portrait && column.key === 'portraitUrl')).map(column =>
        <label key={column.key} className={column.kind === 'multiline' || column.kind === 'url' ? 'admin-catalog-create-wide' : undefined}>
          {column.label}<CatalogField column={column} draft={draft} setDraft={setDraft} label={`New ${column.label}`} disabled={busy} />
        </label>)}
    </div>
    {character && <div className="admin-catalog-portrait">
      {portrait && <img src={portrait.url} alt="Selected portrait preview" />}
      <div><label>Upload portrait<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
        onChange={event => selectPortrait(event.target.files?.[0] ?? null)} /></label>
        <p>JPEG, PNG, or WebP. Up to 5 MB. Uploaded when saved.</p>
        {portrait && <button type="button" className="secondary-button" disabled={busy} onClick={() => selectPortrait(null)}>Remove image</button>}
      </div>
    </div>}
    <UpdatesError message={error} />
    <div className="admin-catalog-create-footer"><span>Available to games immediately after saving.</span><div>
      <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Discard</button>
      <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
    </div></div>
  </form>;
}
