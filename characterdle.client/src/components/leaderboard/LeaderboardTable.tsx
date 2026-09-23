import type { GameMode } from '../../types/game';
import type { ModeLeaderboardEntry } from '../../types/leaderboard';
import { SupporterBadge } from '../ui/SupporterBadge';
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
    <LeaderboardStatsTable
      columns={[winsLabel, 'Avg. Guesses', 'Attempts']}
      rows={rows.map(row => ({ ...row, values: [row.wins, formatAverageGuesses(row.averageGuesses), row.plays] }))}
    />
  );
}

type LeaderboardStatsRow = Pick<ModeLeaderboardEntry,
  'userId' | 'rank' | 'displayName' | 'avatarUrl' | 'showSupporterBadge' | 'isCurrentUser'> & {
  values: [string | number, string | number, string | number];
};

export function LeaderboardStatsTable({ columns, rows, label = 'Global leaderboard' }: {
  columns: [string, string, string];
  rows: LeaderboardStatsRow[];
  label?: string;
}) {
  return (
    <section className="leaderboard-table glass-card" role="table" aria-label={label} tabIndex={0}>
      <div className="table-row table-head" role="row">
        {['Rank', 'Player', ...columns].map(column => <span role="columnheader" key={column}>{column}</span>)}
      </div>
      {rows.map((row) => (
        <div className={`table-row ${row.isCurrentUser ? 'is-current-user' : ''}`} role="row" key={row.userId}>
          <span className="rank-medal" role="cell">{row.rank}</span>
          <div className="player-cell" role="cell">
            <UserAvatar avatarUrl={row.avatarUrl} displayName={row.displayName} isPremium={row.showSupporterBadge} size="leaderboard" className="avatar" />
            <div className="player-copy">
              <div className="player-name-row">
                <strong>{row.displayName}</strong>
                {row.showSupporterBadge && <SupporterBadge compact />}
              </div>
              {row.isCurrentUser && <small>You</small>}
            </div>
          </div>
          {row.values.map((value, index) => <strong role="cell" key={columns[index]}>{value}</strong>)}
        </div>
      ))}
    </section>
  );
}
