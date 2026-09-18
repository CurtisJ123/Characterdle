import type { ChangeEvent } from 'react';
import type { CatalogColumn, CatalogDraft } from '../../lib/adminCatalogTable';

export function CatalogField<Row>({ column, draft, setDraft, label, disabled = false }: {
  column: CatalogColumn<Row>; draft: CatalogDraft; setDraft: (value: CatalogDraft) => void; label: string; disabled?: boolean;
}) {
  const props = { 'aria-label': label, value: draft[column.key] ?? '', disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft(column.change?.(draft, event.target.value) ?? { ...draft, [column.key]: event.target.value }) };
  if (column.kind === 'list' || column.kind === 'multiline') return <textarea {...props} rows={column.kind === 'list' ? 4 : 6}
    required={!column.optional && column.kind !== 'list'} maxLength={column.maxLength} placeholder={column.kind === 'list' ? 'One value per line' : undefined} />;
  if (column.kind === 'boolean') return <select {...props} required><option value="" disabled>Choose...</option><option value="true">Alive</option><option value="false">Dead</option></select>;
  if (column.kind === 'select') return <select {...props} required={!column.optional}>
    <option value="" disabled={!column.optional}>{column.optional ? 'None' : 'Choose...'}</option>
    {column.options?.(draft).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
  return <input {...props} type={column.kind === 'number' ? 'number' : 'text'} min={column.min} max={column.max}
    step={column.kind === 'number' ? 1 : undefined} required={!column.optional} maxLength={column.maxLength} />;
}
