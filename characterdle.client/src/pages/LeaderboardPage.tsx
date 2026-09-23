import { useMemo, useState } from 'react';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { LeaderboardHero } from '../components/leaderboard/LeaderboardHero';
import { StreakLeaderboardTable } from '../components/leaderboard/StreakLeaderboardTable';
import { EpisodeLadderLeaderboardView } from '../components/leaderboard/EpisodeLadderLeaderboard';
import { MetricRow } from '../components/ui/MetricRow';
import { useAuth } from '../hooks/useAuth';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useEpisodeLadderLeaderboard } from '../hooks/useEpisodeLadderLeaderboard';
import { useUniverse } from '../hooks/useUniverse';
import type { GameMode } from '../types/game';
import type {
  LeaderboardEntry,
  LeaderboardModeOverview,
  ModeLeaderboardEntry,
} from '../types/leaderboard';

type LeaderboardView = GameMode | 'streak';

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

function getWinRate(wins: number, plays: number): number | null {
  return plays > 0
    ? (wins / plays) * 100
    : null;
}

function formatRate(value: number | null): string {
  return value === null
    ? '--'
    : `${value.toFixed(1)}%`;
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
  const [selectedView, setSelectedView] = useState<LeaderboardView>('streak');
  const selectedMode: GameMode = selectedView === 'quote' ? 'quote' : 'character';
  const { session, user, isLoading: isAuthLoading } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useLeaderboard(
    selectedUniverse.id,
    session?.access_token ?? null,
    user?.id ?? 'guest',
  );
  const ladder = useEpisodeLadderLeaderboard(
    selectedUniverse.id,
    session?.access_token ?? null,
    user?.id ?? 'guest',
    selectedUniverse.id === 'got' && !isAuthLoading,
  );
  const rows = data?.rows ?? [];
  const streakRows = data?.streakRows ?? [];
  const streakMap = useMemo(() => new Map(streakRows.map((row) => [row.userId, row.currentStreak])), [streakRows]);
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
        currentStreak: typeof row.currentStreak === 'number'
          ? row.currentStreak
          : (streakMap.get(row.userId) ?? 0),
        displayName: row.displayName,
        isCurrentUser: row.isCurrentUser,
        plays: getModePlays(row, selectedMode),
        rank: index + 1,
        showSupporterBadge: row.showSupporterBadge,
        totalWins: row.totalWins,
        userId: row.userId,
        wins: getModeWins(row, selectedMode),
      }))
  ), [rows, selectedMode, streakMap]);
  const topPlayer = rankedRows[0] ?? null;
  const currentUser = rankedRows.find((row) => row.isCurrentUser) ?? null;
  const topStreakPlayer = streakRows[0] ?? null;
  const currentUserStreak = data?.currentUserStreak ?? null;
  const featuredDisplayName = selectedView === 'streak'
    ? topStreakPlayer?.displayName
    : topPlayer?.displayName;

  return (
    <main className="page">
      <div className="leaderboard-mode-toggle" aria-label="Leaderboard mode">
        <button
          className={selectedView === 'streak' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedView('streak')}
        >
          Streaks
        </button>
        <button
          className={selectedView === 'character' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedView('character')}
        >
          Character
        </button>
        <button
          className={selectedView === 'quote' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedView('quote')}
        >
          Quote
        </button>
        {selectedUniverse.id === 'got' && <button
          className={selectedView === 'episode_ladder' ? 'is-active' : ''}
          type="button"
          onClick={() => setSelectedView('episode_ladder')}
        >
          Episode Ladder
        </button>}
      </div>

      {selectedView === 'episode_ladder' && selectedUniverse.id === 'got' ? (
        <EpisodeLadderLeaderboardView data={ladder.data} loading={ladder.isLoading}
          error={ladder.error?.message ?? null} onRetry={ladder.retry} />
      ) : <>
      <LeaderboardHero
        displayName={featuredDisplayName}
        emptyTitle={selectedView === 'streak' ? 'No streaks yet' : 'No ranked players yet'}
        stats={selectedView === 'streak' ? [
          { label: 'Current Streak', value: `${topStreakPlayer?.currentStreak ?? 0} days` },
          { label: 'Longest Streak', value: `${topStreakPlayer?.longestStreak ?? 0} days` },
        ] : [
          { label: `${modeLabel} Wins`, value: topPlayer?.wins ?? 0 },
          { label: 'Win Rate', value: formatRate(topPlayer ? getWinRate(topPlayer.wins, topPlayer.plays) : null) },
          { label: 'Avg. Guesses', value: topPlayer?.averageGuesses?.toFixed(1) ?? '--' },
        ]}
      >
          {selectedView === 'streak' ? (
            <>
              <h2>{currentUserStreak ? 'Your Streak Standing' : 'Streak Overview'}</h2>
              <MetricRow
                label={currentUserStreak ? 'Your Rank' : 'Top Current'}
                value={currentUserStreak ? `#${currentUserStreak.rank}` : String(topStreakPlayer?.currentStreak ?? 0)}
              />
              <MetricRow
                label="Current Streak"
                value={`${currentUserStreak?.currentStreak ?? topStreakPlayer?.currentStreak ?? 0} days`}
              />
              <MetricRow
                label="Longest Streak"
                value={`${currentUserStreak?.longestStreak ?? topStreakPlayer?.longestStreak ?? 0} days`}
              />
            </>
          ) : (
            <>
              <h2>{currentUser ? `Your ${modeLabel} Standing` : `${modeLabel} Overview`}</h2>
              {currentUser ? (
                <>
                  <MetricRow label="Your Rank" value={`#${currentUser.rank}`} />
                  <MetricRow label="Players" value={String(overview.playerCount)} />
                  <MetricRow label="Wins" value={String(currentUser.wins)} />
                </>
              ) : (
                <>
                  <MetricRow label="Players" value={String(overview.playerCount)} />
                  <MetricRow label="Wins" value={String(overview.totalWins)} />
                  <MetricRow
                    label="Avg. Guesses"
                    value={overview.averageGuesses === null ? '--' : overview.averageGuesses.toFixed(1)}
                  />
                </>
              )}
            </>
          )}
      </LeaderboardHero>

      {error && <p className="error-copy">Unable to load leaderboard.</p>}
      {isLoading && !error && <p className="muted-copy">Loading leaderboard...</p>}
      {!isLoading && !error && (selectedView === 'streak' ? streakRows.length === 0 : rankedRows.length === 0) && (
        <section className="glass-card empty-state">
          <div>
            <p className="card-kicker">{selectedView === 'streak' ? 'Streak leaderboard' : `${modeLabel} leaderboard`}</p>
            <h2>No entries yet</h2>
          </div>
        </section>
      )}
      {!isLoading && !error && selectedView !== 'streak' && rankedRows.length > 0 && (
        <LeaderboardTable mode={selectedMode} rows={rankedRows} />
      )}
      {!isLoading && !error && selectedView === 'streak' && streakRows.length > 0 && (
        <StreakLeaderboardTable rows={streakRows} />
      )}
      </>}
    </main>
  );
}
import '../styles/leaderboard.css';
