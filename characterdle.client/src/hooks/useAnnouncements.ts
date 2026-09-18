import { useEffect, useState } from 'react';
import type { Announcement, LatestAnnouncement } from '../types/announcements';
import { updatesRequest, updateMutation } from '../services/announcementsApi';
import { rememberAnnouncement, seenAnnouncements } from '../lib/announcementState';

export function useAnnouncements(token: string | null, userId: string | undefined, loading: boolean) {
  const owner = userId ?? 'guest';
  const [state, setState] = useState<{ owner: string; post: Announcement | null; seen: boolean; isAdmin: boolean }>({ owner: '', post: null, seen: true, isAdmin: false });
  useEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    let lastFetch = 0;
    async function refresh(force = false) {
      if (!force && Date.now() - lastFetch < 30000) return;
      lastFetch = Date.now();
      try {
        const data = await updatesRequest<LatestAnnouncement>('/api/updates/latest', token, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const localSeen = data.post && (seenAnnouncements(userId).includes(data.post.id) || (!!userId && seenAnnouncements().includes(data.post.id)));
        if (localSeen && !data.seen && token && data.post) await updateMutation(`/api/updates/${data.post.id}/seen`, token, 'POST');
        if (!controller.signal.aborted) setState(previous => ({ owner, post: data.post, seen: data.seen || !!localSeen, isAdmin: previous.owner === owner && previous.isAdmin }));
      } catch { /* Announcements must not block gameplay, login, or billing. */ }
    }
    void refresh(true);
    if (token) void updatesRequest<{ isAdmin: boolean }>('/api/admin/access', token, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState(previous => ({ owner, post: previous.owner === owner ? previous.post : null,
        seen: previous.owner === owner ? previous.seen : true, isAdmin: result.isAdmin }));
    }).catch(() => {});
    function onFocus() { if (document.visibilityState === 'visible') void refresh(); }
    function onSeen() {
      setState(previous => previous.owner === owner && previous.post && seenAnnouncements(userId).includes(previous.post.id) ? { ...previous, seen: true } : previous);
    }
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onSeen);
    window.addEventListener('characterdle:announcement-seen', onSeen);
    return () => {
      controller.abort(); window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onSeen);
      window.removeEventListener('characterdle:announcement-seen', onSeen);
    };
  }, [token, userId, owner, loading]);
  return { post: state.owner === owner && !loading ? state.post : null,
    unread: state.owner === owner && !state.seen && !loading,
    isAdmin: state.owner === owner && state.isAdmin && !loading,
    markSeen: (id: string) => { rememberAnnouncement(id, userId); setState(previous => previous.post?.id === id ? { ...previous, seen: true } : previous); } };
}
