import { useState } from 'react';
import { playerDate } from '../../lib/adminPlayersTable';
import { parseModerationGuests } from '../../lib/playerModeration';
import { updateMutation, updatesRequest, UpdatesApiError } from '../../services/announcementsApi';
import type { AdminPlayerDetails, GuestEvidence, PlayerModerationState, SavePlayerModeration } from '../../types/playerModeration';

export function PlayerModerationEditor({ data, token, onChanged, onReload }: {
  data: AdminPlayerDetails; token: string; onChanged: () => void; onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<PlayerModerationState['state']>(data.moderation.state);
  const [reason, setReason] = useState('');
  const [guests, setGuests] = useState(data.moderation.guestLinks.map(link => link.guestId).join('\n'));
  const [expiry, setExpiry] = useState('');
  const [review, setReview] = useState<GuestEvidence[] | null>(null);
  const [transfers, setTransfers] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<SavePlayerModeration | null>(null);
  function begin(next: PlayerModerationState['state']) {
    setState(next); setEditing(true); setReason(''); setReview(null); setError(''); setConflict(false);
    // datetime-local is local time, not UTC.
    const date = data.moderation.expiresAt && next === 'shadow_banned' ? new Date(data.moderation.expiresAt) : null;
    setExpiry(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  }
  async function preview() {
    setError(''); setConflict(false); setBusy(true);
    try {
      const guestIds = parseModerationGuests(guests);
      if (!reason.trim() || reason.length > 2000) throw new Error('Enter an internal reason of 1 to 2,000 characters.');
      const expiresAt = state === 'shadow_banned' && expiry ? new Date(expiry).toISOString() : null;
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error('Choose a future expiry.');
      const evidence = await Promise.all(guestIds.map(id => updatesRequest<GuestEvidence>(`/api/admin/players/guest/${id}`, token)));
      setPending({ state, reason: reason.trim(), expiresAt, expectedRevision: data.moderation.revision,
        requestId: crypto.randomUUID(), guestIds, reassignments: [], confirmed: true });
      setReview(evidence); setTransfers([]); setConfirmed(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to preview this change.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!pending || !review || !confirmed) return;
    setBusy(true); setError(''); setConflict(false);
    const conflicts = review.filter(guest => guest.linkedUserId && guest.linkedUserId !== data.profile.id);
    const body = { ...pending, reassignments: conflicts.map(guest => ({
      guestId: guest.guestId, fromUserId: guest.linkedUserId!, expectedRevision: guest.linkedRevision!,
    })) };
    // Preserve request ID and payload for safe retries after an uncertain response.
    setPending(body);
    try {
      await updateMutation(`/api/admin/players/${data.profile.id}/moderation`, token, 'PUT', body);
      onChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save moderation.');
      setConflict(failure instanceof UpdatesApiError && failure.status === 409);
    } finally { setBusy(false); }
  }
  const conflicts = review?.filter(guest => guest.linkedUserId && guest.linkedUserId !== data.profile.id) ?? [];
  if (!editing) return <div className="player-tools">
    {data.canRestrict ? <button className="player-danger" onClick={() => begin('shadow_banned')}>
      {data.moderation.isRestricted ? 'Edit restriction / guest links' : 'Shadow Ban'}
    </button> : <p className="player-notice">Administrator and self-restrictions are disabled.</p>}
    {(data.moderation.state !== 'normal' || data.moderation.guestLinks.length > 0) &&
      <button onClick={() => begin('normal')}>{data.moderation.state !== 'normal' ? 'Remove restriction' : 'Manage guest links'}</button>}
  </div>;
  return <section className="player-moderation-editor" aria-label="Confirm moderation change">
    <h4>{state === 'shadow_banned' ? 'Leaderboard and comment restriction' : 'Normal leaderboard and comment visibility'}</h4>
    <p><strong>{data.profile.displayName}</strong><br /><code>{data.profile.id}</code></p>
    <p>Links are an administrator's decision, not proof of identity. Browser IDs can be cleared, copied or changed. This does not block gameplay or prevent access to shared answers.</p>
    {!review ? <form onSubmit={event => { event.preventDefault(); void preview(); }}>
      <fieldset disabled={busy}>
        <label>Required internal reason<textarea maxLength={2000} required value={reason} onChange={event => setReason(event.target.value)} rows={3} /></label>
        {state === 'shadow_banned' && <label>Expiry (your local time; empty = indefinite)<input type="datetime-local" value={expiry} onChange={event => setExpiry(event.target.value)} /></label>}
        <label>Guest IDs (optional, one per line)<textarea rows={3} value={guests} onChange={event => setGuests(event.target.value)} placeholder="guest:UUID or UUID" /></label>
        <p className="player-muted">Remove an ID here to unlink it. Removing a restriction preserves the listed associations but disables their special view.</p>
        <div className="player-tools"><button type="submit">Review change</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </fieldset>
    </form> : <div>
      <h4>Review before saving</h4>
      <p><strong>{pending?.state === 'shadow_banned' ? 'Shadow ban' : 'Remove restriction / normal visibility'}</strong>
        {' '}until {pending?.expiresAt ? playerDate(pending.expiresAt) : 'no expiry'}.</p>
      <p className="player-reason">Reason: {pending?.reason}</p>
      {review.length ? <ul className="player-evidence">{review.map(guest => <li key={guest.guestId}>
        <code>{guest.guestId}</code><p>{guest.recordedGames} recorded summaries / {guest.completedGames} completed. Last activity: {playerDate(guest.lastPlayedAt)}.</p>
        {guest.linkedUserId && guest.linkedUserId !== data.profile.id ? <label className="player-checkbox">
          <input type="checkbox" disabled={busy} checked={transfers.includes(guest.guestId)} onChange={event =>
            setTransfers(ids => event.target.checked ? [...ids, guest.guestId] : ids.filter(id => id !== guest.guestId))} />
          Explicitly reassign from {guest.linkedDisplayName} ({guest.linkedUserId}) to {data.profile.displayName}. Both accounts' histories will record this transfer.
        </label> : <p>{guest.linkedUserId ? 'Already associated with this player.' : 'Not currently associated with an account.'}</p>}
      </li>)}</ul> : <p>No guest IDs will be associated.</p>}
      <p><strong>Guest IDs to unlink:</strong> {data.moderation.guestLinks.filter(link => !pending?.guestIds.includes(link.guestId)).map(link => link.guestId).join(', ') || 'None'}</p>
      <label className="player-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
        I confirm this player, reason, expiry and guest-link changes. Leaderboard and comment visibility changes; comments are not deleted, and results, gameplay, premium and billing remain unchanged.
      </label>
      <div className="player-tools"><button className="player-danger" disabled={busy || !confirmed || conflicts.some(guest => !transfers.includes(guest.guestId)) || conflict}
        onClick={() => void save()}>{busy ? 'Saving...' : 'Confirm and save'}</button>
        <button disabled={busy} onClick={() => { setReview(null); setPending(null); }}>Back to edit</button>
        <button disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
    </div>}
    {error && <p className="player-error" role="alert">{error}</p>}
    {conflict && <button onClick={onReload}>Reload current state</button>}
  </section>;
}
