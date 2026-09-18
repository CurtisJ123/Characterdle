import { useId, useState, type FormEvent } from 'react';
import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import { updateMutation } from '../../services/announcementsApi';
import type { AnnouncementComment, AnnouncementPage } from '../../types/announcements';
import { UserAvatar } from '../ui/UserAvatar';
import { UpdatesError, UpdatesPagination } from './UpdatesCommon';

export function PostComments({ postId, token, onLogin }: {
  postId: string; token: string | null; onLogin: () => void;
}) {
  const countId = useId();
  const [page, setPage] = useState(1);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const path = `/api/updates/${postId}/comments?page=${page}`;
  const result = useUpdatesResource<AnnouncementPage<AnnouncementComment>>(path, token);

  async function mutate(path: string, method: string, value?: unknown) {
    if (!token || busy) return false;
    setBusy(true); setError(''); setNotice('');
    try { await updateMutation(path, token, method, value); result.reload(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save comment.'); return false; }
    finally { setBusy(false); }
  }
  async function post(event: FormEvent) {
    event.preventDefault();
    if (await mutate(`/api/updates/${postId}/comments`, 'POST', { body })) {
      setBody(''); setNotice('Comment posted.');
    }
  }
  return <section className="updates-comments glass-card" aria-label="Post comments">
    <h2>Comments</h2>
    <UpdatesError message={error || result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading comments...</p>}
    <p className="updates-sr-only" role="status">{notice}</p>
    {result.data && <>
      {!result.data.items.length && <p className="muted-copy">No comments yet.</p>}
      <ol className="updates-comment-list">{result.data.items.map(comment => <li key={comment.id} className={comment.isHidden ? 'is-hidden-comment' : ''}>
        <UserAvatar displayName={comment.displayName} avatarUrl={comment.avatarUrl} isPremium={comment.showSupporterBadge} />
        <div className="updates-comment-copy">
          <div className="updates-comment-meta"><strong>{comment.displayName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></div>
          <p>{comment.body}</p>
          {comment.isOwn && (deleteId === comment.id ? <div className="updates-inline-actions">
              <span>Delete your comment?</span>
              <button className="updates-text-button" disabled={busy} onClick={() => void mutate(`/api/updates/comments/${comment.id}`, 'DELETE').then(ok => { if (ok) setDeleteId(null); })}>Delete</button>
              <button className="updates-text-button" disabled={busy} onClick={() => setDeleteId(null)}>Keep</button>
            </div> : <button className="updates-text-button" disabled={busy} onClick={() => setDeleteId(comment.id)}>Delete</button>)}
        </div>
      </li>)}</ol>
      <UpdatesPagination page={page} hasNextPage={result.data.hasNextPage} onChange={setPage} disabled={busy} />
      {token ? <form onSubmit={post} className="updates-comment-form">
        <div><textarea aria-label="Write a comment" placeholder="Write a comment..." rows={2} required maxLength={300}
          value={body} onChange={event => setBody(event.target.value)} disabled={busy} aria-describedby={countId} />
          <span id={countId} className="updates-count">{body.length}/300</span></div>
        <button className="primary-button" disabled={busy || !body.trim()}>{busy ? 'Posting...' : 'Post'}</button>
      </form> : <button className="secondary-button" onClick={onLogin}>Sign in to comment</button>}
    </>}
  </section>;
}
