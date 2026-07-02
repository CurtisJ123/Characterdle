import type { StreakLeaderboardEntry } from '../../types/leaderboard';
import { StreakEmblem } from '../ui/StreakEmblem';
import { UserAvatar } from '../ui/UserAvatar';

interface StreakLeaderboardTableProps {
  rows: StreakLeaderboardEntry[];
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
            <UserAvatar avatarUrl={row.avatarUrl} displayName={row.displayName} size="leaderboard" className="avatar" />
            <div className="player-copy">
              <strong>{row.displayName}</strong>
              <small>{row.isCurrentUser ? 'You' : 'Daily player'}</small>
            </div>
          </div>
          <div className="streak-value-cell">
            <StreakEmblem className="streak-value-icon" showCount={false} streak={row.currentStreak} />
            <span className="streak-value-copy">
              <strong>{row.currentStreak}</strong>
              <small>days</small>
            </span>
          </div>
          <div className="streak-value-cell">
            <span className="streak-value-copy">
              <strong>{row.longestStreak}</strong>
              <small>days</small>
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
