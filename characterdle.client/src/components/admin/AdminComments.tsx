import { useState } from 'react';
import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import { updateMutation } from '../../services/announcementsApi';
import type { AdminComment } from '../../types/admin';
import type { AnnouncementPage } from '../../types/announcements';
import { UserAvatar } from '../ui/UserAvatar';
import { UpdatesError, UpdatesPagination } from '../updates/UpdatesCommon';

export function AdminComments({ token }: { token: string }) {
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const result = useUpdatesResource<AnnouncementPage<AdminComment>>(`/api/admin/comments?page=${page}&source=${source}`, token);
  async function moderate(comment: AdminComment) {
    if (busy || !comment.canModerate) return;
    setBusy(true); setError('');
    try {
      await updateMutation(`/api/admin/comments/${comment.id}`, token, 'PUT', { hidden: !comment.isHidden });
      result.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update comment.'); }
    finally { setBusy(false); }
  }
  return <section className="glass-card admin-comments" aria-label="Comment moderation">
    <div className="updates-editor-heading"><div><h2>Comments</h2><p className="admin-dashboard-caption">Newest first, across updates and games.</p></div>
      <label className="admin-comment-filter">Source
        <select value={source} disabled={busy} onChange={event => { setSource(event.target.value); setPage(1); setError(''); }}>
          <option value="all">All comments</option><option value="updates">Updates</option><option value="games">Games</option>
        </select>
      </label>
    </div>
    <UpdatesError message={error || result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading comments...</p>}
    {result.data && <>
      {!result.data.items.length && <p>No comments found.</p>}
      <ol className="admin-comment-list">{result.data.items.map(comment => <li key={`${comment.source}:${comment.id}`}>
        <div className="admin-comment-author"><UserAvatar displayName={comment.displayName} avatarUrl={comment.avatarUrl} />
          <div><strong>{comment.displayName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
        </div>
        <div className="admin-comment-body">
          <div className="admin-comment-context"><span className="admin-source-badge">{comment.source === 'game' ? 'Game' : 'Update'}</span>
            <a href={comment.contextUrl}>{comment.contextTitle}</a>{comment.isHidden && <span className="admin-hidden-badge">Hidden</span>}</div>
          <p>{comment.body}</p>
          {comment.canModerate && <button className="updates-text-button" disabled={busy} onClick={() => void moderate(comment)}>
            {comment.isHidden ? 'Restore comment' : 'Hide comment'}</button>}
        </div>
      </li>)}</ol>
      <UpdatesPagination page={page} hasNextPage={result.data.hasNextPage} onChange={setPage} disabled={busy} />
    </>}
  </section>;
}
