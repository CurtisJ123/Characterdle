import type { LeaderboardRow } from '../../types/game';

interface MiniLeaderboardCardProps {
  rows: LeaderboardRow[];
  onViewAll: () => void;
}

export function MiniLeaderboardCard({ rows, onViewAll }: MiniLeaderboardCardProps) {
  return (
    <article className="glass-card mini-board">
      <div className="section-heading">
        <h2>Global Rankings</h2>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {rows.slice(0, 3).map((row) => (
        <div className="mini-rank" key={row.player}>
          <span className="rank-number">{row.rank}</span>
          <span className="avatar">{row.player.slice(0, 2).toUpperCase()}</span>
          <strong>{row.player}</strong>
          <span>{row.wins}</span>
        </div>
      ))}
    </article>
  );
}
