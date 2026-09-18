import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Announcement } from '../../types/announcements';
import { PostBody } from './PostBody';
import { PostComments } from './PostComments';
import { UpdatesError } from './UpdatesCommon';
import '../../pages/UpdatesPage.css';

export function UpdateDialog({ post, loading = false, error, retry, token, onClose, onLogin }: {
  post?: Announcement | null; loading?: boolean; error?: string; retry?: () => void;
  token: string | null; onClose: () => void; onLogin: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close(); document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="updates-popup updates-page" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="updates-popup-layout">
      <header className="updates-popup-heading">
        <div><p className="eyebrow">Latest update</p><h2 id={titleId}>{post?.title ?? 'Characterdle updates'}</h2>
          {post?.publishedAt && <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</time>}</div>
        <button type="button" className="updates-popup-close" aria-label="Close update" onClick={onClose} autoFocus>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="updates-popup-content" tabIndex={0} aria-label="Update content">
        {loading && <p role="status">Loading latest update...</p>}
        <UpdatesError message={error} retry={retry} />
        {!loading && !error && !post && <p>No updates published yet.</p>}
        {post && <>
          <PostBody body={post.bodyMarkdown} />
          <PostComments key={post.id} postId={post.id} token={token} onLogin={onLogin} />
        </>}
      </div>
      <footer className="updates-popup-footer">
        <a className="secondary-button" href="/updates">View older updates</a>
        <button type="button" className="primary-button" onClick={onClose}>Close</button>
      </footer>
    </div>
  </dialog>, document.body);
}
