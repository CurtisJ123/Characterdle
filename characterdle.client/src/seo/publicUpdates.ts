import type { Announcement, AnnouncementPage } from '../types/announcements';

export interface PublicUpdates {
  path: string;
  post?: Announcement;
  list?: AnnouncementPage<Announcement>;
}

export function readPublicUpdates(path: string): PublicUpdates | undefined {
  if (typeof document === 'undefined') return;
  const element = document.getElementById('public-updates');
  if (!element?.textContent) return;
  try {
    const data = JSON.parse(element.textContent) as PublicUpdates;
    return data.path === path ? data : undefined;
  } catch { return; }
}
