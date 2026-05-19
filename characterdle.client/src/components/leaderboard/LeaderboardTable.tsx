import type { LeaderboardRow } from '../../types/game';

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
}

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <section className="leaderboard-table glass-card" aria-label="Global leaderboard">
      <div className="table-row table-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Wins</span>
        <span>Avg. Guesses</span>
        <span>Mastery</span>
      </div>
      {rows.map((row) => (
        <div className="table-row" key={row.player}>
          <span className={`rank-medal rank-${row.rank}`}>{row.rank}</span>
          <div className="player-cell">
            <span className="avatar">{row.player.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{row.player}</strong>
              <small>{row.tier}</small>
            </div>
          </div>
          <strong>{row.wins}</strong>
          <strong>{row.guesses}</strong>
          <div className="mastery-list">
            {row.mastery.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        </div>
      ))}
    </section>
  );
}
