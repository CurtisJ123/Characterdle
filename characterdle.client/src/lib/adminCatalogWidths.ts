export const catalogActionsColumn = '__actions';
export const maxCatalogColumnWidth = 1000;

export function minCatalogColumnWidth(key: string) {
  return key === 'id' ? 64 : key === catalogActionsColumn ? 92 : 100;
}

export function clampCatalogColumnWidth(key: string, width: number) {
  return Math.round(Math.min(maxCatalogColumnWidth, Math.max(minCatalogColumnWidth(key), width)));
}

export function catalogWidthCookieName(path: string): string | null {
  if (path === '/api/admin/got/characters') return 'characterdle_admin_characters_columns_v1';
  if (path === '/api/admin/got/quotes') return 'characterdle_admin_quotes_columns_v1';
  if (path === '/api/admin/players') return 'characterdle_admin_players_columns_v1';
  return null;
}

function validWidths(value: unknown, keys: readonly string[]): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue;
    const width = (value as Record<string, unknown>)[key];
    if (typeof width === 'number' && Number.isFinite(width)) result[key] = clampCatalogColumnWidth(key, width);
  }
  return result;
}

export function readCatalogWidths(cookies: string, path: string, keys: readonly string[]): Record<string, number> {
  const name = catalogWidthCookieName(path);
  if (!name) return {};
  const value = cookies.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value || value.length > 4096) return {};
  try { return validWidths(JSON.parse(decodeURIComponent(value)), keys); }
  catch { return {}; }
}

export function catalogWidthsCookie(path: string, widths: Record<string, number>, keys: readonly string[], secure: boolean): string | null {
  const name = catalogWidthCookieName(path);
  if (!name) return null;
  const value = encodeURIComponent(JSON.stringify(validWidths(widths, keys)));
  // Host-only: staging and production keep separate preferences. No account or game data is stored.
  return `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`;
}
