import type { EpisodeLadderLeaderboardData, EpisodeLadderLeaderboardEntry } from '../../types/leaderboard';
import { MetricRow } from '../ui/MetricRow';
import { LeaderboardHero } from './LeaderboardHero';
import { LeaderboardStatsTable } from './LeaderboardTable';

export function EpisodeLadderLeaderboardTable({ rows, label = 'Episode Ladder leaderboard' }: {
  rows: EpisodeLadderLeaderboardEntry[]; label?: string;
}) {
  return (
    <LeaderboardStatsTable
      label={label}
      columns={['Total Points', 'Points per Day', 'Days Played']}
      rows={rows.map(row => ({ ...row, values: [row.totalPoints, row.pointsPerDay.toFixed(2), row.daysPlayed] }))}
    />
  );
}

export function EpisodeLadderLeaderboardView({ data, loading, error, onRetry }: {
  data: EpisodeLadderLeaderboardData | null; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const top = data?.rows[0];
  const current = data?.currentUser;
  const outsideTop = current && !data?.rows.some(row => row.userId === current.userId);
  const rows = outsideTop ? [...(data?.rows ?? []), current] : data?.rows ?? [];
  return (
    <>
      <LeaderboardHero
        displayName={top?.displayName}
        stats={[
          { label: 'Total Points', value: top?.totalPoints ?? 0 },
          { label: 'Points per Day', value: top?.pointsPerDay.toFixed(2) ?? '--' },
          { label: 'Days Played', value: top?.daysPlayed ?? 0 },
        ]}
      >
        <h2>{current ? 'Your Episode Ladder Standing' : 'Episode Ladder Overview'}</h2>
        {current ? <>
          <MetricRow label="Your Rank" value={`#${current.rank}`} />
          <MetricRow label="Players" value={String(data?.overview.playerCount ?? 0)} />
          <MetricRow label="Total Points" value={String(current.totalPoints)} />
        </> : <>
          <MetricRow label="Players" value={String(data?.overview.playerCount ?? 0)} />
          <MetricRow label="Total Points" value={String(data?.overview.totalPoints ?? 0)} />
          <MetricRow label="Points per Day" value={data?.overview.pointsPerDay.toFixed(2) ?? '--'} />
        </>}
      </LeaderboardHero>

      {error && <div role="alert"><p className="error-copy">{error}</p>
        <button type="button" className="secondary-button" onClick={onRetry}>Try again</button></div>}
      {loading && !error && <p className="muted-copy" role="status">Loading leaderboard...</p>}
      {!loading && !error && rows.length === 0 && (
        <section className="glass-card empty-state">
          <div>
            <p className="card-kicker">Episode Ladder leaderboard</p>
            <h2>No entries yet</h2>
          </div>
        </section>
      )}
      {!loading && !error && rows.length > 0 && <EpisodeLadderLeaderboardTable rows={rows} />}
    </>
  );
}
