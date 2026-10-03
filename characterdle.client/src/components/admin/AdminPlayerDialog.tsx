import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUpdatesResource } from '../../hooks/useUpdatesResource';
import { playerDate } from '../../lib/adminPlayersTable';
import { adminModeName, difficultyName } from '../../lib/playerModeration';
import { clearLeaderboardCache } from '../../services/leaderboardApi';
import { commentVisibilityChanged } from '../../hooks/useCommentRefresh';
import { profileResource } from '../../lib/accountData';
import type { AdminActivityPage, AdminGameHistory, AdminPageResult, AdminPlayerDetails, ModerationAuditEntry } from '../../types/playerModeration';
import { UserAvatar } from '../ui/UserAvatar';
import { UpdatesError } from '../updates/UpdatesCommon';
import { PlayerModerationEditor } from './PlayerModerationEditor';
import './AdminPlayerDialog.css';

export function AdminPlayerDialog({ userId, token, onClose, onChanged }: {
  userId: string; token: string; onClose: () => void; onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [tab, setTab] = useState('Overview');
  const result = useUpdatesResource<AdminPlayerDetails>(`/api/admin/players/${userId}`, token);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => {
      element.close(); document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  function changed() {
    window.dispatchEvent(new Event(commentVisibilityChanged));
    clearLeaderboardCache(); profileResource.clear(); result.reload();
    setRevision(value => value + 1); onChanged();
  }
  return createPortal(<dialog ref={dialog} className="admin-player-dialog" aria-labelledby={title}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="player-dialog-header">
      <div className="player-dialog-identity">
        {result.data && <UserAvatar displayName={result.data.profile.displayName} avatarUrl={result.data.profile.avatarUrl} isPremium={result.data.profile.membership !== 'Free'} />}
        <div><p className="player-kicker">Player details / administrator only</p><h2 id={title}>{result.data?.profile.displayName ?? 'Player details'}</h2></div>
      </div>
      <button className="player-close" aria-label="Close player details" onClick={onClose} autoFocus>&times;</button>
    </header>
    <nav className="player-dialog-tabs" aria-label="Player details sections">{['Overview', 'Games', 'Activity', 'Moderation'].map(name =>
      <button key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <div className="player-dialog-content">
      <UpdatesError message={result.error} retry={result.reload} />
      {result.loading && <p role="status">Loading player details...</p>}
      {result.data && <>
        {tab === 'Overview' && <Overview data={result.data} />}
        {tab === 'Games' && <Games userId={userId} token={token} data={result.data} />}
        {tab === 'Activity' && <Activity userId={userId} token={token} />}
        {tab === 'Moderation' && <section>
          <h3>Leaderboard and comment visibility</h3>
          <p className="player-notice">Restricted players are hidden from other players' leaderboards and comment sections, but can still see their own entries and comments. Admin comment tools remain unfiltered. Gameplay, saved results, premium access and billing remain unchanged. No notification is sent to the player.</p>
          <dl className="player-facts">
            <Fact label="Effective status" value={result.data.moderation.isRestricted ? 'Shadow Banned' : 'Normal'} />
            <Fact label="Expiry" value={result.data.moderation.expiresAt ? playerDate(result.data.moderation.expiresAt) : 'Indefinite / none'} />
            <Fact label="Last change" value={playerDate(result.data.moderation.updatedAt)} />
            <Fact label="Administrator" value={result.data.moderation.updatedBy ?? 'None'} />
          </dl>
          <p className="player-reason"><strong>Internal reason:</strong> {result.data.moderation.reason || 'No moderation history.'}</p>
          <h4>Active guest associations</h4>
          <p className="player-muted">These preserve the account's leaderboard and public announcement-comment views while its restriction is active. They do not grant account access or unlock game comments.</p>
          {result.data.moderation.guestLinks.length ? <ul>{result.data.moderation.guestLinks.map(link =>
            <li key={link.guestId}><CopyValue value={link.guestId} /> <small>Linked {playerDate(link.linkedAt)}</small></li>)}</ul> : <p>No guest IDs linked.</p>}
          <PlayerModerationEditor key={`${revision}:${result.data.moderation.revision}`} data={result.data} token={token} onChanged={changed} onReload={result.reload} />
          <History key={revision} userId={userId} token={token} />
        </section>}
      </>}
    </div>
    <footer className="player-dialog-footer"><span>Read-only investigation, except explicitly confirmed moderation changes.</span><button onClick={onClose}>Close</button></footer>
  </dialog>, document.body);
}

function CopyValue({ value }: { value: string }) {
  const [message, setMessage] = useState('');
  return <span className="player-copy"><code>{value}</code><button onClick={() => {
    void navigator.clipboard.writeText(value).then(() => setMessage('Copied'), () => setMessage('Copy unavailable; select the text.'));
  }}>Copy</button><span role="status">{message}</span></span>;
}
function Fact({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
function Overview({ data }: { data: AdminPlayerDetails }) {
  const p = data.profile;
  return <section><h3>Account overview</h3>
    <p>User ID <CopyValue value={p.id} /></p><p>Email <CopyValue value={p.email} /></p>
    <dl className="player-facts">
      <Fact label="Created" value={playerDate(p.createdAt)} />
      <Fact label="Last recorded gameplay" value={playerDate(p.lastPlayedAt)} />
      <Fact label="Membership" value={p.membership} /><Fact label="Administrator" value={data.isAdmin ? 'Yes' : 'No'} />
      <Fact label="Current streak" value={p.currentStreak} /><Fact label="Longest streak" value={p.longestStreak} />
      <Fact label="Billing status" value={data.billing.status ?? 'None'} />
      <Fact label="Current period start" value={playerDate(data.billing.currentPeriodStart)} />
      <Fact label="Current period end" value={playerDate(data.billing.currentPeriodEnd)} />
      <Fact label="Cancels at period end" value={data.billing.cancelAtPeriodEnd ? 'Yes' : 'No'} />
      <Fact label="Scheduled cancellation" value={playerDate(data.billing.cancelAt)} />
    </dl><p className="player-muted">Last recorded gameplay is not last sign-in. No authentication secrets or payment-card information are shown.</p>
  </section>;
}
function Pagination({ page, hasNext, onChange }: { page: number; hasNext: boolean; onChange: (page: number) => void }) {
  return <div className="player-pagination"><button disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
    <span>Page {page}</span><button disabled={!hasNext} onClick={() => onChange(page + 1)}>Next</button></div>;
}
function Games({ userId, token, data }: { userId: string; token: string; data: AdminPlayerDetails }) {
  const [page, setPage] = useState(1); const [mode, setMode] = useState('all');
  const result = useUpdatesResource<AdminPageResult<AdminGameHistory>>(`/api/admin/players/${userId}/games?page=${page}&mode=${mode}`, token);
  const p = data.profile;
  return <section><h3>Recorded games</h3><dl className="player-facts">
    <Fact label="Character wins / attempts" value={`${p.characterWins} / ${p.characterAttempts}`} />
    <Fact label="Quote wins / attempts" value={`${p.quoteWins} / ${p.quoteAttempts}`} />
    <Fact label="Ladder points / days" value={`${p.ladderPoints} / ${p.ladderDaysPlayed}`} />
    <Fact label="Ladder points per day" value={p.ladderPointsPerDay} />
    <Fact label="Ladder first-attempt win rate" value={`${data.ladderFirstAttemptWinRate}%`} />
  </dl><p className="player-muted">First-attempt wins divided by all completed Ladder difficulties, including losses. Attempt orders below contain event IDs, not guest histories.</p>
    <label className="player-filter">Game mode<select value={mode} onChange={event => { setMode(event.target.value); setPage(1); }}>
      <option value="all">All games</option><option value="character">Character</option><option value="quote">Quote</option><option value="episode_ladder">Episode Ladder</option>
    </select></label><UpdatesError message={result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading games...</p>}
    {result.data && <>{!result.data.items.length ? <p>No recorded games.</p> : <div className="player-table-scroll"><table>
      <thead><tr><th>Game</th><th>Result</th><th>Guesses / attempts</th><th>Hints</th><th>Points</th><th>Recorded at (UTC)</th></tr></thead>
      <tbody>{result.data.items.map((game, index) => <tr key={index}>
        <td>{adminModeName(game.mode)} #{game.gameId}<small>{game.universeId} {difficultyName(game.difficulty)}</small>
          {game.attempts && <details><summary>Attempt orders</summary><ol>{game.attempts.map((order, i) => <li key={i}><code>{order.join(' > ')}</code></li>)}</ol></details>}</td>
        <td>{game.status}</td><td>{game.guessCount}</td><td>{game.hintCount}</td>
        <td>{game.points === null ? 'N/A' : <>{game.points}<small>Day total: {game.dailyPoints}</small></>}</td><td>{playerDate(game.completedAt)}</td>
      </tr>)}</tbody></table></div>}
      <Pagination page={page} hasNext={result.data.hasNextPage} onChange={setPage} /></>}
  </section>;
}
function Activity({ userId, token }: { userId: string; token: string }) {
  const [page, setPage] = useState(1); const [guest, setGuest] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const result = useUpdatesResource<AdminActivityPage>(`/api/admin/players/${userId}/activity?page=${page}${guest ? `&guestId=${encodeURIComponent(guest)}` : ''}`, token);
  return <section><h3>Activity and guest comparisons</h3>
    <div className="player-notice"><strong>Evidence limits</strong><p>These are overwritable participant/game summaries, not immutable events or complete per-difficulty guest histories.
      We do not have reliable puzzle-open times, completion durations, or guest/account IP identity matches. A match is not proof of cheating or identity.</p>
      <p>Search covers this account's latest 1,000 recorded game summaries. Each match is the closest earlier guest completion for the same universe, mode and game ID.
        Filtering a guest finds that guest's closest earlier completion instead. Repeated matches below use the same bounded set.</p></div>
    <form className="player-tools" onSubmit={event => { event.preventDefault(); setGuest(guestInput.trim()); setPage(1); }}>
      <label>Investigate guest UUID<input value={guestInput} onChange={event => setGuestInput(event.target.value)} placeholder="guest:UUID or UUID" /></label>
      <button type="submit">Investigate</button><button type="button" onClick={() => { setGuest(''); setGuestInput(''); setPage(1); }}>All guests</button>
    </form><UpdatesError message={result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading recorded activity...</p>}
    {result.data && <><h4>Repeated earlier guest matches</h4>
      {result.data.repeatedGuests.length ? <ul className="player-match-list">{result.data.repeatedGuests.map(match =>
        <li key={match.guestKey}><button onClick={() => { setGuest(match.guestKey); setGuestInput(match.guestKey); setPage(1); }}>{match.guestKey}</button>
          <span>{match.matches} matches; latest {playerDate(match.lastMatchAt)}</span></li>)}</ul> : <p>No earlier guest matches in this set.</p>}
      {!result.data.history.items.length ? <p>No recorded activity matches this filter.</p> : <div className="player-table-scroll"><table>
        <thead><tr><th>Account gameplay</th><th>Account timestamps (UTC)</th><th>Earlier guest completion</th><th>Time between records</th></tr></thead>
        <tbody>{result.data.history.items.map(row => <tr key={`${row.universeId}:${row.mode}:${row.gameId}`}>
          <td>{adminModeName(row.mode)} #{row.gameId}<small>{row.status ?? 'Unknown'} / {row.guessCount} guesses</small></td>
          <td>Updated {playerDate(row.updatedAt)}<small>Completed {playerDate(row.completedAt)}</small></td>
          <td>{row.guestKey ? <><CopyValue value={row.guestKey} /><small>{row.guestStatus}, {row.guestGuessCount} guesses</small><small>{playerDate(row.guestCompletedAt)}</small></> : 'None recorded'}</td>
          <td>{row.secondsBefore === null ? 'N/A' : `${Math.round(row.secondsBefore)} seconds earlier`}</td>
        </tr>)}</tbody></table></div>}
      <Pagination page={page} hasNext={result.data.history.hasNextPage} onChange={setPage} /></>}
  </section>;
}
function History({ userId, token }: { userId: string; token: string }) {
  const [page, setPage] = useState(1);
  const result = useUpdatesResource<AdminPageResult<ModerationAuditEntry>>(`/api/admin/players/${userId}/moderation-history?page=${page}`, token);
  return <section className="player-history"><h3>Audit history</h3><UpdatesError message={result.error} retry={result.reload} />
    {result.loading && <p role="status">Loading audit history...</p>}
    {result.data && <>{!result.data.items.length ? <p>No moderation changes recorded.</p> : result.data.items.map(entry =>
      <details key={entry.id}><summary>{playerDate(entry.createdAt)} / {entry.action === 'guest-reassigned' ? 'Guest reassigned' : 'Moderation changed'}</summary>
        <p>{entry.reason}</p><p>Administrator: <code>{entry.actorId}</code></p>
        <p>{entry.previousState.state} to {entry.newState.state}; expiry: {playerDate(entry.newState.expiresAt)}</p>
        <p>Before: {entry.previousState.guestLinks.map(link => link.guestId).join(', ') || 'No guest links'}</p>
        <p>After: {entry.newState.guestLinks.map(link => link.guestId).join(', ') || 'No guest links'}</p>
        <small>Request: {entry.requestId}</small>
      </details>)}<Pagination page={page} hasNext={result.data.hasNextPage} onChange={setPage} /></>}
  </section>;
}
