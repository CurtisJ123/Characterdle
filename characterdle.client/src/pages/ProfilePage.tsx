import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { useUniverse } from '../hooks/useUniverse';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface ProfilePageProps {
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

function getInitials(displayName: string | undefined) {
  if (!displayName) {
    return '??';
  }

  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatAverage(value: number | null) {
  return value === null ? '--' : value.toFixed(1);
}

function formatMode(mode: string) {
  return mode === 'quote' ? 'Quote' : 'Character';
}

function formatStatus(status: string) {
  return status === 'won' ? 'Won' : 'Lost';
}

export function ProfilePage({ onAuthNavigate, onNavigate }: ProfilePageProps) {
  const { isAuthenticated, session, signOut, updateAccount, user } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading, reload } = useProfile(session?.access_token ?? null, selectedUniverse.id);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string>();
  const [formMessage, setFormMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const memberSince = useMemo(() => (
    data
      ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
      }).format(new Date(data.memberSince))
      : '--'
  ), [data]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setEmail(user?.email ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
  }, [user?.avatarUrl, user?.displayName, user?.email, user?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFormMessage(undefined);

    if (!displayName.trim()) {
      setFormError('Username is required.');
      return;
    }

    if (!email.trim()) {
      setFormError('Email is required.');
      return;
    }

    if (password && password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateAccount({
        avatarUrl,
        displayName,
        email,
        password,
      });

      await reload();
      setPassword('');
      setConfirmPassword('');
      setFormMessage(result.message);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      onAuthNavigate('login');
    } catch (signOutError) {
      setFormError(signOutError instanceof Error ? signOutError.message : 'Unable to log out right now.');
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="page profile-page">
        <section className="glass-card profile-empty-state">
          <p className="eyebrow">Profile</p>
          <h1>Log in to view your profile</h1>
          <div className="button-stack">
            <button className="primary-button large-button" type="button" onClick={() => onAuthNavigate('login')}>
              Log in
            </button>
            <button className="secondary-button large-button" type="button" onClick={() => onNavigate('launcher')}>
              Back home
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page profile-page">
      <section className="profile-hero glass-card">
        <div className="profile-hero-main">
          {data?.avatarUrl ? (
            <img className="profile-hero-avatar" src={data.avatarUrl} alt="" />
          ) : (
            <span className="profile-hero-avatar is-fallback" aria-hidden="true">
              {getInitials(data?.displayName ?? user?.displayName)}
            </span>
          )}

          <div className="profile-hero-copy">
            <p className="eyebrow">{selectedUniverse.title}</p>
            <h1>{data?.displayName ?? user?.displayName ?? 'Profile'}</h1>
            <p className="profile-subtitle">{data?.email ?? user?.email ?? 'ERROR'}</p>
            <div className="profile-meta-row">
              <span className="pill">Member since {memberSince}</span>
              <span className="pill">Overall rank {data?.overallRank ? `#${data.overallRank}` : '--'}</span>
            </div>
          </div>
        </div>

        <div className="profile-stat-grid">
          <article className="glass-card profile-stat-card">
            <span>Total Wins</span>
            <strong>{data?.totalWins ?? 0}</strong>
          </article>
          <article className="glass-card profile-stat-card">
            <span>Total Plays</span>
            <strong>{data?.totalPlays ?? 0}</strong>
          </article>
          <article className="glass-card profile-stat-card">
            <span>Win Rate</span>
            <strong>{data ? `${data.winRate.toFixed(1)}%` : '--'}</strong>
          </article>
          <article className="glass-card profile-stat-card">
            <span>Avg Guess</span>
            <strong>{data ? formatAverage(data.averageGuesses) : '--'}</strong>
          </article>
        </div>
      </section>

      {error && <p className="error-copy">Unable to load profile.</p>}
      {isLoading && !error && <p className="muted-copy">Loading profile...</p>}

      <section className="profile-layout">
        <div className="profile-column">
          <section className="glass-card profile-panel">
            <div className="profile-panel-header">
              <div>
                <p className="card-kicker">Stats</p>
                <h2>Game breakdown</h2>
              </div>
            </div>

            <div className="profile-mode-grid">
              <article className="glass-card profile-mode-card">
                <div className="profile-mode-header">
                  <h3>Character</h3>
                  <span className="pill">{data?.character.rank ? `#${data.character.rank}` : '--'}</span>
                </div>
                <dl className="profile-mode-stats">
                  <div><dt>Wins</dt><dd>{data?.character.wins ?? 0}</dd></div>
                  <div><dt>Plays</dt><dd>{data?.character.plays ?? 0}</dd></div>
                  <div><dt>Losses</dt><dd>{data?.character.losses ?? 0}</dd></div>
                  <div><dt>Avg Guess</dt><dd>{data ? formatAverage(data.character.averageGuesses) : '--'}</dd></div>
                  <div><dt>Avg Hints</dt><dd>{data ? formatAverage(data.character.averageHints) : '--'}</dd></div>
                </dl>
              </article>

              <article className="glass-card profile-mode-card">
                <div className="profile-mode-header">
                  <h3>Quote</h3>
                  <span className="pill">{data?.quote.rank ? `#${data.quote.rank}` : '--'}</span>
                </div>
                <dl className="profile-mode-stats">
                  <div><dt>Wins</dt><dd>{data?.quote.wins ?? 0}</dd></div>
                  <div><dt>Plays</dt><dd>{data?.quote.plays ?? 0}</dd></div>
                  <div><dt>Losses</dt><dd>{data?.quote.losses ?? 0}</dd></div>
                  <div><dt>Avg Guess</dt><dd>{data ? formatAverage(data.quote.averageGuesses) : '--'}</dd></div>
                  <div><dt>Avg Hints</dt><dd>{data ? formatAverage(data.quote.averageHints) : '--'}</dd></div>
                </dl>
              </article>
            </div>
          </section>

          <section className="glass-card profile-panel">
            <div className="profile-panel-header">
              <div>
                <p className="card-kicker">Recent</p>
                <h2>Recent results</h2>
              </div>
            </div>

            {data && data.recentResults.length > 0 ? (
              <div className="profile-results-list">
                {data.recentResults.map((result) => (
                  <article key={`${result.mode}-${result.gameId}-${result.completedAt}`} className="profile-result-row">
                    <div>
                      <strong>{formatMode(result.mode)} #{result.gameId}</strong>
                      <span>
                        {new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(result.completedAt))}
                      </span>
                    </div>
                    <div className="profile-result-meta">
                      <span className={`profile-status-chip is-${result.status}`}>{formatStatus(result.status)}</span>
                      <span>{result.guessCount} guesses</span>
                      <span>{result.hintCount} hints</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted-copy">No finished games yet.</p>
            )}
          </section>
        </div>

        <aside className="profile-column">
          <section className="glass-card profile-panel">
            <div className="profile-panel-header">
              <div>
                <p className="card-kicker">Settings</p>
                <h2>Account</h2>
              </div>
            </div>

            <form className="profile-settings-form" onSubmit={handleSubmit}>
              <label>
                Username
                <input
                  autoComplete="nickname"
                  name="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              <label>
                Email
                <input
                  autoComplete="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label>
                Avatar URL
                <input
                  autoComplete="url"
                  name="avatarUrl"
                  placeholder="https://..."
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                />
              </label>

              <label>
                New password
                <input
                  autoComplete="new-password"
                  name="password"
                  placeholder="Leave blank to keep current password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <label>
                Confirm password
                <input
                  autoComplete="new-password"
                  name="confirmPassword"
                  placeholder="Repeat new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>

              {formMessage && <p className="auth-feedback is-success">{formMessage}</p>}
              {formError && <p className="auth-feedback is-error">{formError}</p>}

              <div className="profile-settings-actions">
                <button className="primary-button" disabled={isSaving} type="submit">
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
                <button className="secondary-button" disabled={isSaving} type="button" onClick={handleSignOut}>
                  Log out
                </button>
              </div>
            </form>
          </section>
        </aside>
      </section>
    </main>
  );
}
