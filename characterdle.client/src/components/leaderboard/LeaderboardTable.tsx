import type { GameMode } from '../../types/game';
import type { ModeLeaderboardEntry } from '../../types/leaderboard';
import { UserAvatar } from '../ui/UserAvatar';

interface LeaderboardTableProps {
  mode: GameMode;
  rows: ModeLeaderboardEntry[];
}

function formatAverageGuesses(value: number | null) {
  if (value === null) {
    return '--';
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export function LeaderboardTable({ mode, rows }: LeaderboardTableProps) {
  const winsLabel = mode === 'quote' ? 'Quote Wins' : 'Character Wins';

  return (
    <section className="leaderboard-table glass-card" aria-label="Global leaderboard">
      <div className="table-row table-head">
        <span>Rank</span>
        <span>Player</span>
        <span>{winsLabel}</span>
        <span>Avg. Guesses</span>
        <span>Plays</span>
      </div>
      {rows.map((row) => (
        <div className={`table-row ${row.isCurrentUser ? 'is-current-user' : ''}`} key={row.userId}>
          <span className="rank-medal">{row.rank}</span>
          <div className="player-cell">
            <UserAvatar avatarUrl={row.avatarUrl} displayName={row.displayName} size="leaderboard" className="avatar" />
            <div className="player-copy">
              <strong>{row.displayName}</strong>
              <small>{row.isCurrentUser ? 'You' : 'Ranked player'}</small>
            </div>
          </div>
          <strong>{row.wins}</strong>
          <strong>{formatAverageGuesses(row.averageGuesses)}</strong>
          <strong>{row.plays}</strong>
        </div>
      ))}
    </section>
  );
}
