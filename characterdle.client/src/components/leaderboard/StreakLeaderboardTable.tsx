import type { StreakLeaderboardEntry } from '../../types/leaderboard';

interface StreakLeaderboardTableProps {
  rows: StreakLeaderboardEntry[];
}

function getInitials(displayName: string) {
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function StreakLeaderboardTable({ rows }: StreakLeaderboardTableProps) {
  return (
    <section className="leaderboard-table glass-card" aria-label="Streak leaderboard">
      <div className="table-row streak-table-row table-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Current Streak</span>
        <span>Longest Streak</span>
      </div>
      {rows.map((row) => (
        <div
          className={`table-row streak-table-row ${row.isCurrentUser ? 'is-current-user' : ''}`}
          key={row.userId}
        >
          <span className="rank-medal">{row.rank}</span>
          <div className="player-cell">
            <span className="avatar">{getInitials(row.displayName)}</span>
            <div>
              <strong>{row.displayName}</strong>
              <small>{row.isCurrentUser ? 'You' : 'Daily player'}</small>
            </div>
          </div>
          <strong>{row.currentStreak} days</strong>
          <strong>{row.longestStreak} days</strong>
        </div>
      ))}
    </section>
  );
}
