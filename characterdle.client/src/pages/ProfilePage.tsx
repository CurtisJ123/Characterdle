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
  return value === null ? '0.0' : value.toFixed(1);
}

function formatRank(value: number | null) {
  return value === null ? 'Unranked' : `#${value}`;
}

function formatMode(mode: string) {
  return mode === 'quote' ? 'Quote' : 'Character';
}

function formatStatus(status: string) {
  return status === 'won' ? 'Won' : 'Lost';
}

export function ProfilePage({ onAuthNavigate, onNavigate }: ProfilePageProps) {
  const { isAuthenticated, session, user } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useProfile(session?.access_token ?? null, selectedUniverse.id);
  const hasProfileData = Boolean(data);
  const isInitialLoad = isLoading && !hasProfileData;
  const memberSinceValue = data?.memberSince ?? user?.createdAt;
  const memberSince = memberSinceValue
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(memberSinceValue))
    : 'Recently joined';

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
      <section className={`profile-hero glass-card${isInitialLoad ? ' is-loading' : ''}`}>
        <div className="profile-hero-main">
          {data?.avatarUrl ? (
            <img className="profile-hero-avatar" src={data.avatarUrl} alt="" />
          ) : (
            <span className="profile-hero-avatar is-fallback" aria-hidden="true">
              {getInitials(user?.displayName ?? data?.displayName)}
            </span>
          )}

          <div className="profile-hero-copy">
            <p className="eyebrow">{selectedUniverse.title}</p>
            <h1>{user?.displayName ?? data?.displayName ?? 'Profile'}</h1>
            <div className="profile-meta-row">
              <span className="pill">Member since {memberSince}</span>
              <span className="pill">Overall rank {formatRank(data?.overallRank ?? null)}</span>
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
            <span>Total Completion</span>
            <strong>{data ? `${data.totalCompletionRate.toFixed(1)}%` : '0.0%'}</strong>
          </article>
          <article className="glass-card profile-stat-card">
            <span>Avg Guess</span>
            <strong>{data ? formatAverage(data.averageGuesses) : '0.0'}</strong>
          </article>
        </div>
      </section>

      {error && <p className="error-copy">Unable to load profile.</p>}

      <section className="profile-layout">
        <div className="profile-column">
          <section className={`glass-card profile-panel${isInitialLoad ? ' is-loading' : ''}`}>
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
                  <span className="pill">{formatRank(data?.character.rank ?? null)}</span>
                </div>
                <dl className="profile-mode-stats">
                  <div><dt>Wins</dt><dd>{data?.character.wins ?? 0}</dd></div>
                  <div><dt>Plays</dt><dd>{data?.character.plays ?? 0}</dd></div>
                  <div><dt>Losses</dt><dd>{data?.character.losses ?? 0}</dd></div>
                  <div><dt>Completion</dt><dd>{data ? `${data.character.completionRate.toFixed(1)}%` : '0.0%'}</dd></div>
                  <div><dt>Avg Guess</dt><dd>{data ? formatAverage(data.character.averageGuesses) : '0.0'}</dd></div>
                  <div><dt>Avg Hints</dt><dd>{data ? formatAverage(data.character.averageHints) : '0.0'}</dd></div>
                </dl>
              </article>

              <article className="glass-card profile-mode-card">
                <div className="profile-mode-header">
                  <h3>Quote</h3>
                  <span className="pill">{formatRank(data?.quote.rank ?? null)}</span>
                </div>
                <dl className="profile-mode-stats">
                  <div><dt>Wins</dt><dd>{data?.quote.wins ?? 0}</dd></div>
                  <div><dt>Plays</dt><dd>{data?.quote.plays ?? 0}</dd></div>
                  <div><dt>Losses</dt><dd>{data?.quote.losses ?? 0}</dd></div>
                  <div><dt>Completion</dt><dd>{data ? `${data.quote.completionRate.toFixed(1)}%` : '0.0%'}</dd></div>
                  <div><dt>Avg Guess</dt><dd>{data ? formatAverage(data.quote.averageGuesses) : '0.0'}</dd></div>
                  <div><dt>Avg Hints</dt><dd>{data ? formatAverage(data.quote.averageHints) : '0.0'}</dd></div>
                </dl>
              </article>
            </div>
          </section>

          <section className={`glass-card profile-panel${isInitialLoad ? ' is-loading' : ''}`}>
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
            ) : isInitialLoad ? (
              <div className="profile-results-placeholder" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <p className="muted-copy profile-empty-copy">No games yet.</p>
            )}
          </section>
        </div>

      </section>
    </main>
  );
}
