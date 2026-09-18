import { readPublicConfig } from './runtimeConfig';
import { updateMutation } from '../services/announcementsApi';

const fallback = new Map<string, string[]>();
function key(userId?: string) { return `characterdle:announcement-views:${readPublicConfig().supabaseUrl}:${userId ?? 'guest'}`; }
export function seenAnnouncements(userId?: string): string[] {
  const name = key(userId);
  try {
    const value: unknown = JSON.parse(localStorage.getItem(name) ?? '[]');
    const stored = Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
    return [...new Set([...stored, ...(fallback.get(name) ?? [])])].slice(-100);
  }
  catch { return fallback.get(name) ?? []; }
}
export function rememberAnnouncement(id: string, userId?: string, notify = true) {
  const name = key(userId), ids = [...new Set([...seenAnnouncements(userId), id])].slice(-100);
  fallback.set(name, ids);
  try { localStorage.setItem(name, JSON.stringify(ids)); } catch { /* Session memory still prevents repeated prompts. */ }
  if (notify) window.dispatchEvent(new Event('characterdle:announcement-seen'));
}
export async function markAnnouncementRead(id: string, token: string | null, userId?: string) {
  rememberAnnouncement(id, userId);
  if (token) { try { await updateMutation(`/api/updates/${id}/seen`, token, 'POST'); } catch { /* Retried on the next latest-announcement check. */ } }
}
