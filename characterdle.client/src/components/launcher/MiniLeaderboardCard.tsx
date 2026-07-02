import type { LeaderboardEntry } from '../../types/leaderboard';
import { UserAvatar } from '../ui/UserAvatar';

const HOME_LEADERBOARD_LIMIT = 10;

interface MiniLeaderboardCardProps {
  error: Error | null;
  isLoading: boolean;
  rows: LeaderboardEntry[];
  onViewAll: () => void;
}

export function MiniLeaderboardCard({ error, isLoading, rows, onViewAll }: MiniLeaderboardCardProps) {
  return (
    <article className="glass-card mini-board">
      <div className="section-heading">
        <h2>Leaderboard</h2>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {error && <p className="muted-copy">Unable to load leaderboard.</p>}
      {!error && isLoading && <p className="muted-copy">Loading leaderboard...</p>}
      {!error && !isLoading && rows.length === 0 && (
        <p className="muted-copy">No entries yet.</p>
      )}
      {!error && rows.slice(0, HOME_LEADERBOARD_LIMIT).map((row) => (
        <div className="mini-rank" key={row.userId}>
          <span className="rank-number">{row.rank}</span>
          <UserAvatar avatarUrl={row.avatarUrl} displayName={row.displayName} size="leaderboard" className="avatar" />
          <strong>{row.displayName}</strong>
          <span>{row.totalWins}</span>
        </div>
      ))}
    </article>
  );
}
