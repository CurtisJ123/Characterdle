import { buildApiUrl } from '../lib/runtimeConfig';

export class UpdatesApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function updatesRequest<T>(path: string, token: string | null = null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const catalog = path.startsWith('/api/admin/got/');
    let message = response.status === 401 ? 'Please sign in to continue.'
      : response.status === 403 ? 'This area is restricted to administrators.'
        : response.status === 404 ? catalog ? 'This game content is no longer available.' : 'This post or comment is no longer available.'
          : response.status === 413 ? 'Images must be 5 MB or smaller.'
          : catalog ? 'Game content is temporarily unavailable. Please try again.' : 'Updates are temporarily unavailable. Please try again.';
    const problem = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
    if ([400, 409, 413, 429].includes(response.status))
      message = problem?.detail ?? Object.values(problem?.errors ?? {}).flat()[0] ?? message;
    throw new UpdatesApiError(response.status, message);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function updateMutation<T>(path: string, token: string, method: string, body?: unknown) {
  return updatesRequest<T>(path, token, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

export function uploadAnnouncementImage(token: string, file: File) {
  return updatesRequest<{ url: string }>('/api/admin/updates/images', token, {
    method: 'POST', body: file, headers: { 'Content-Type': file.type }, signal: AbortSignal.timeout(60000),
  });
}
