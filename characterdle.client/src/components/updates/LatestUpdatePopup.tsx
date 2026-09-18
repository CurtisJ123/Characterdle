import { useEffect, useRef } from 'react';
import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import { markAnnouncementRead } from '../../lib/announcementState';
import type { Announcement } from '../../types/announcements';
import { UpdateDialog } from './UpdateDialog';

export function LatestUpdatePopup({ token, userId, onSeen, onClose, onLogin }: {
  token: string | null; userId?: string; onSeen: (id: string) => void;
  onClose: () => void; onLogin: () => void;
}) {
  const result = useUpdatesResource<{ post: Announcement | null }>('/api/updates/current');
  const postId = result.data?.post?.id;
  const onSeenRef = useRef(onSeen);
  useEffect(() => { onSeenRef.current = onSeen; }, [onSeen]);
  useEffect(() => {
    if (!postId) return;
    void markAnnouncementRead(postId, token, userId);
    onSeenRef.current(postId);
  }, [postId, token, userId]);
  return <UpdateDialog post={result.data?.post} loading={result.loading} error={result.error} retry={result.reload}
    token={token} onClose={onClose} onLogin={onLogin} />;
}
