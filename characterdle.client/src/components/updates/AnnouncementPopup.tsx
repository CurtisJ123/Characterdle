import { useEffect, useRef, useState } from 'react';
import { UpdateDialog } from './UpdateDialog';
import type { Announcement } from '../../types/announcements';
import { updateMutation } from '../../services/announcementsApi';
import { seenAnnouncements, rememberAnnouncement } from '../../lib/announcementState';
import '../../pages/UpdatesPage.css';

export function AnnouncementPopup({ post, unread, token, userId, onSeen, onLogin }: {
  post: Announcement; unread: boolean; token: string | null; userId?: string; onSeen: (id: string) => void; onLogin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const onSeenRef = useRef(onSeen);
  useEffect(() => { onSeenRef.current = onSeen; }, [onSeen]);
  useEffect(() => {
    if (!unread) return;
    let disposed = false;
    let claiming = false;
    let done = false;
    const readyAt = Date.now() + 1800;
    function safeMoment() {
      return Date.now() >= readyAt && document.visibilityState === 'visible' && !document.querySelector('[role="dialog"], dialog[open], [aria-modal="true"]')
        && !(document.activeElement instanceof HTMLElement && document.activeElement.matches('input, textarea, select, [contenteditable="true"]'));
    }
    async function maybeShow() {
      if (disposed || claiming || done || !safeMoment()) return;
      claiming = true;
      try {
        const claim = async () => {
          if (seenAnnouncements(userId).includes(post.id)) return false;
          if (token) {
            const result = await updateMutation<{ claimed: boolean }>(`/api/updates/${post.id}/claim`, token, 'POST');
            return result.claimed;
          }
          // Notify only after opening; otherwise the unread-state update can cancel this claim.
          rememberAnnouncement(post.id, undefined, false);
          return true;
        };
        const claimed = !token && navigator.locks
          ? await navigator.locks.request(`announcement:${post.id}`, claim) : await claim();
        if (disposed) return;
        done = true;
        if (claimed && safeMoment()) setOpen(true);
        // Keep this mounted while open; the parent uses the unread state only for its badge.
        onSeenRef.current(post.id);
      } catch { done = true; }
      finally { claiming = false; }
    }
    const timer = window.setTimeout(() => void maybeShow(), 1800);
    function retry() { void maybeShow(); }
    window.addEventListener('focus', retry);
    document.addEventListener('focusout', retry);
    const observer = new MutationObserver(retry);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal'] });
    return () => { disposed = true; clearTimeout(timer); observer.disconnect(); window.removeEventListener('focus', retry); document.removeEventListener('focusout', retry); };
  }, [post.id, token, userId, unread]);
  if (!open || dismissed) return null;
  return <UpdateDialog post={post} token={token} onClose={() => setDismissed(true)}
    onLogin={() => { setDismissed(true); onLogin(); }} />;
}
