export type CatalogDraft = Record<string, string>;
export interface CatalogColumn<Row> {
  key: keyof Row & string;
  label: string;
  kind: 'readonly' | 'text' | 'multiline' | 'list' | 'number' | 'boolean' | 'select' | 'url';
  value: (row: Row) => string | number | null;
  search?: (row: Row) => string;
  min?: number;
  max?: number;
  maxLength?: number;
  optional?: boolean;
  wide?: boolean;
  options?: (draft: CatalogDraft) => { value: string; label: string }[];
  change?: (draft: CatalogDraft, value: string) => CatalogDraft;
}

export function selectCatalogRows<Row extends { id: number }>(rows: readonly Row[], columns: readonly CatalogColumn<Row>[],
  query: string, filters: Record<string, string>, sortKey: string, direction: 'asc' | 'desc'): Row[] {
  const text = (row: Row, column: CatalogColumn<Row>) => (column.search?.(row) ?? String(column.value(row) ?? '')).toLocaleLowerCase();
  const search = query.trim().toLocaleLowerCase();
  const filtered = rows.filter(row => (!search || columns.some(column => text(row, column).includes(search)))
    && columns.every(column => !filters[column.key]?.trim() || text(row, column).includes(filters[column.key].trim().toLocaleLowerCase())));
  const sort = columns.find(column => column.key === sortKey) ?? columns[0];
  return filtered.sort((a, b) => {
    const av = sort.value(a), bv = sort.value(b);
    if (av === null || bv === null) return av === bv ? a.id - b.id : av === null ? 1 : -1;
    const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return (direction === 'asc' ? compared : -compared) || a.id - b.id;
  });
}

export function catalogDraft<Row>(row: Row, columns: readonly CatalogColumn<Row>[]): CatalogDraft {
  return Object.fromEntries(columns.map(column => {
    const value = row[column.key];
    return [column.key, Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value)];
  }));
}

export function catalogPayload<Row>(draft: CatalogDraft, columns: readonly CatalogColumn<Row>[], version?: string) {
  const entries = columns.filter(column => column.kind !== 'readonly').map(column => {
    const value = draft[column.key] ?? '';
    if (column.kind === 'list') return [column.key, value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)];
    if (column.kind === 'boolean') return [column.key, value === 'true'];
    if (column.kind === 'number' || column.kind === 'select') {
      if (!value && column.optional) return [column.key, null];
      const number = Number(value);
      if (!value || !Number.isSafeInteger(number)) throw new Error(`${column.label} must be a whole number.`);
      return [column.key, number];
    }
    return [column.key, column.optional && !value.trim() ? null : value];
  });
  return { ...Object.fromEntries(entries), ...(version === undefined ? {} : { expectedVersion: version }) };
}
