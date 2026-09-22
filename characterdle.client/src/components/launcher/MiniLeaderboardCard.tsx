import type { LeaderboardEntry } from '../../types/leaderboard';
import { UserAvatar } from '../ui/UserAvatar';
import { RouteLink } from '../ui/RouteLink';

const HOME_LEADERBOARD_LIMIT = 10;

interface MiniLeaderboardCardProps {
  error: Error | null;
  isLoading: boolean;
  rows: LeaderboardEntry[];
  onViewAll: () => void;
  viewAllHref: string;
}

export function MiniLeaderboardCard({ error, isLoading, rows, onViewAll, viewAllHref }: MiniLeaderboardCardProps) {
  return (
    <article className="glass-card mini-board">
      <div className="section-heading">
        <h2>Leaderboard</h2>
        <RouteLink className="mini-board-view-all" href={viewAllHref} onNavigate={onViewAll}>View all</RouteLink>
      </div>
      {error && <p className="muted-copy">Unable to load leaderboard.</p>}
      {!error && isLoading && <p className="muted-copy">Loading leaderboard...</p>}
      {!error && !isLoading && rows.length === 0 && (
        <p className="muted-copy">No entries yet.</p>
      )}
      {!error && rows.slice(0, HOME_LEADERBOARD_LIMIT).map((row) => (
        <div className="mini-rank" key={row.userId}>
          <span className="rank-number">{row.rank}</span>
          <UserAvatar avatarUrl={row.avatarUrl} displayName={row.displayName} isPremium={row.showSupporterBadge} size="leaderboard" className="avatar" />
          <strong>{row.displayName}</strong>
          <span>{row.totalWins}</span>
        </div>
      ))}
    </article>
  );
}
