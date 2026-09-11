import { useId, useState, type FormEvent } from 'react';
import { useGameComments } from '../../hooks/useGameComments';
import type { GameCommentsScope } from '../../services/gameCommentsApi';
import { UserAvatar } from '../ui/UserAvatar';

interface GameCommentsProps extends GameCommentsScope {
  accessToken: string;
  userId: string;
}

export function GameComments({ accessToken, userId, universeId, gameId, mode }: GameCommentsProps) {
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const id = useId();
  const comments = useGameComments(accessToken, userId, { universeId, gameId, mode });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || body.length > 300) {
      return;
    }
    setNotice('');
    if (await comments.post(body)) {
      setBody('');
      setNotice('Comment posted.');
    }
  }

  return (
    <section className="game-comments glass-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Comments</h2>
      {comments.isLoading && <p className="muted-copy" role="status">Loading comments...</p>}
      {comments.error && (
        <div className="game-comments-error">
          <p className="error-copy" role="alert">{comments.error}</p>
          {!comments.isLoading && !comments.data && (
            <button type="button" className="secondary-button" onClick={comments.retry}>Try again</button>
          )}
        </div>
      )}
      <p className="game-comments-announcement" role="status">{notice}</p>
      {comments.data && (
        <>
          {comments.data.comments.length > 0 && (
            <ol className="game-comments-list" aria-label="Game comments, oldest first">
              {comments.data.comments.map(comment => (
                <li key={comment.id} className="game-comment">
                  <UserAvatar
                    avatarUrl={comment.avatarUrl}
                    displayName={comment.displayName}
                    isPremium={comment.showSupporterBadge}
                  />
                  <div className="game-comment-copy">
                    <div className="game-comment-meta">
                      <span className="game-comment-author">{comment.displayName}</span>
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </time>
                    </div>
                    <p>{comment.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {(comments.data.page > 1 || comments.data.hasNextPage) && (
            <nav className="game-comments-pagination" aria-label="Comment pages">
              <button type="button" className="secondary-button" disabled={comments.isPosting || comments.data.page === 1} onClick={comments.previous}>
                Previous
              </button>
              <span>Page {comments.data.page}</span>
              <button type="button" className="secondary-button" disabled={comments.isPosting || !comments.data.hasNextPage} onClick={comments.next}>
                Next
              </button>
            </nav>
          )}
          <form className="game-comments-form" onSubmit={handleSubmit}>
            <div className="game-comments-input">
              <textarea
                id={`${id}-body`}
                aria-label="Write a comment"
                placeholder="Write a comment..."
                value={body}
                onChange={event => setBody(event.target.value)}
                maxLength={300}
                rows={2}
                required
                disabled={comments.isPosting}
                aria-describedby={`${id}-count`}
              />
              <span className="game-comments-count" id={`${id}-count`}>{body.length}/300</span>
            </div>
            <button type="submit" className="primary-button" disabled={comments.isPosting || !body.trim()}>
              {comments.isPosting ? 'Posting...' : 'Post'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
