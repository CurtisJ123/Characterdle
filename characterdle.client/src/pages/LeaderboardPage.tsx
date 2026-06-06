import { useMemo, useState } from 'react';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { MetricRow } from '../components/ui/MetricRow';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useUniverse } from '../hooks/useUniverse';
import type { GameMode } from '../types/game';
import type {
  LeaderboardEntry,
  LeaderboardModeOverview,
  ModeLeaderboardEntry,
} from '../types/leaderboard';

function getModeWins(row: LeaderboardEntry, mode: GameMode): number {
  return mode === 'quote'
    ? row.quoteWins
    : row.characterWins;
}

function getModePlays(row: LeaderboardEntry, mode: GameMode): number {
  return mode === 'quote'
    ? row.quotePlays
    : row.characterPlays;
}

function getModeAverageGuesses(row: LeaderboardEntry, mode: GameMode): number | null {
  return mode === 'quote'
    ? row.quoteAverageGuesses
    : row.characterAverageGuesses;
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

export function LeaderboardPage() {
  const [selectedMode, setSelectedMode] = useState<GameMode>('character');
  const { user } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useLeaderboard(selectedUniverse.id, user?.id ?? null);
  const rows = data?.rows ?? [];
  const modeLabel = selectedMode === 'quote' ? 'Quote' : 'Character';
  const overview = useMemo<LeaderboardModeOverview>(() => {
    if (!data) {
      return {
        averageGuesses: null,
        playerCount: 0,
        totalPlays: 0,
        totalWins: 0,
      };
    }

    return selectedMode === 'quote'
      ? data.quoteOverview
      : data.characterOverview;
  }, [data, selectedMode]);
  const rankedRows = useMemo<ModeLeaderboardEntry[]>(() => (
    [...rows]
      .filter((row) => getModePlays(row, selectedMode) > 0)
      .sort((left, right) => {
        const winDifference = getModeWins(right, selectedMode) - getModeWins(left, selectedMode);

        if (winDifference !== 0) {
          return winDifference;
        }

        const averageDifference = compareNullableNumbers(
          getModeAverageGuesses(left, selectedMode),
          getModeAverageGuesses(right, selectedMode),
        );

        if (averageDifference !== 0) {
          return averageDifference;
        }

        const playDifference = getModePlays(right, selectedMode) - getModePlays(left, selectedMode);

        if (playDifference !== 0) {
          return playDifference;
        }

        const totalWinDifference = right.totalWins - left.totalWins;

        if (totalWinDifference !== 0) {
          return totalWinDifference;
        }

        return left.displayName.localeCompare(right.displayName);
      })
      .map((row, index) => ({
        averageGuesses: getModeAverageGuesses(row, selectedMode),
        avatarUrl: row.avatarUrl,
        displayName: row.displayName,
        isCurrentUser: row.isCurrentUser,
        plays: getModePlays(row, selectedMode),
        rank: index + 1,
        totalWins: row.totalWins,
        userId: row.userId,
        wins: getModeWins(row, selectedMode),
      }))
  ), [rows, selectedMode]);
  const topPlayer = rankedRows[0] ?? null;
  const currentUser = rankedRows.find((row) => row.isCurrentUser) ?? null;

  return (
    <main className="page">
      <div className="leaderboard-mode-toggle" aria-label="Leaderboard mode">
        <button
          className={selectedMode === 'character' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedMode('character')}
        >
          Character
        </button>
        <button
          className={selectedMode === 'quote' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedMode('quote')}
        >
          Quote
        </button>
      </div>

      <section className="leaderboard-hero">
        <article className="champion-card glass-card">
          <div className="champion-avatar-shell">
            <div className="champion-avatar" aria-hidden="true">
              {topPlayer
                ? topPlayer.displayName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()
                : '--'}
            </div>
          </div>
          <div className="champion-copy">
            <span className="pill">{selectedUniverse.title} {modeLabel}</span>
            <h1>{topPlayer?.displayName ?? 'No ranked players yet'}</h1>
            <dl className="champion-stats">
              <div className="champion-stat-card">
                <dt>{modeLabel} Wins</dt>
                <dd>{topPlayer?.wins ?? 0}</dd>
              </div>
              <div className="champion-stat-card">
                <dt>Plays</dt>
                <dd>{topPlayer?.plays ?? 0}</dd>
              </div>
              <div className="champion-stat-card">
                <dt>Avg. Guesses</dt>
                <dd>{topPlayer?.averageGuesses?.toFixed(1) ?? '--'}</dd>
              </div>
              <div className="champion-stat-card">
                <dt>Total Wins</dt>
                <dd>{topPlayer?.totalWins ?? 0}</dd>
              </div>
            </dl>
          </div>
        </article>

        <aside className="glass-card pulse-card">
          <h2>{currentUser ? `Your ${modeLabel} Standing` : `${modeLabel} Overview`}</h2>
          <MetricRow label="Players" value={String(overview.playerCount)} />
          <MetricRow
            label={currentUser ? 'Your Rank' : 'Wins'}
            value={currentUser ? `#${currentUser.rank}` : String(overview.totalWins)}
          />
          <MetricRow
            label={currentUser ? 'Wins' : 'Avg. Guesses'}
            value={currentUser
              ? String(currentUser.wins)
              : overview.averageGuesses === null
                ? '--'
                : overview.averageGuesses.toFixed(1)}
          />
          <MetricRow
            label={currentUser ? 'Avg. Guesses' : 'Rounds'}
            value={currentUser
              ? currentUser.averageGuesses === null
                ? '--'
                : currentUser.averageGuesses.toFixed(1)
              : String(overview.totalPlays)}
          />
          {currentUser && <MetricRow label="Rounds" value={String(currentUser.plays)} />}
        </aside>
      </section>

      {error && <p className="error-copy">Unable to load leaderboard.</p>}
      {isLoading && !error && <p className="muted-copy">Loading leaderboard...</p>}
      {!isLoading && !error && rankedRows.length === 0 && (
        <section className="glass-card empty-state">
          <div>
            <p className="card-kicker">{modeLabel} leaderboard</p>
            <h2>No entries yet</h2>
          </div>
        </section>
      )}
      {!isLoading && !error && rankedRows.length > 0 && (
        <LeaderboardTable mode={selectedMode} rows={rankedRows} />
      )}
    </main>
  );
}
