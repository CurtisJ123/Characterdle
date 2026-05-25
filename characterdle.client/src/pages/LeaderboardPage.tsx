import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { MetricRow } from '../components/ui/MetricRow';
import { leaderboardRows } from '../data/prototypeData';

export function LeaderboardPage() {
  return (
    <main className="page">
      <section className="leaderboard-hero">
        <article className="champion-card glass-card">
          <div className="champion-avatar" aria-hidden="true">P1</div>
          <div>
            <span className="pill">Top Player</span>
            <h1>PlayerOne</h1>
            <p>Current top score in the sample leaderboard.</p>
            <dl className="champion-stats">
              <div>
                <dt>Total Wins</dt>
                <dd>1,284</dd>
              </div>
              <div>
                <dt>Avg. Guesses</dt>
                <dd>3.2</dd>
              </div>
              <div>
                <dt>Win Streak</dt>
                <dd>42</dd>
              </div>
            </dl>
          </div>
        </article>

        <aside className="glass-card pulse-card">
          <h2>Overview</h2>
          <MetricRow label="Active Today" value="12,402" />
          <MetricRow label="Characters Solved" value="89.2k" />
          <MetricRow label="Hardest Category" value="Region" danger />
          <button className="primary-button" type="button">View Your Rank</button>
        </aside>
      </section>

      <section className="filters" aria-label="Leaderboard filters">
        <div className="segmented-control">
          <button className="is-selected" type="button">Daily</button>
          <button type="button">Weekly</button>
          <button type="button">All-Time</button>
        </div>
        <div className="filter-pills">
          <span>All Players</span>
          <span>Fastest</span>
          <span>Most Wins</span>
          <span>Top Streaks</span>
          <span>Lowest Average</span>
        </div>
      </section>

      <LeaderboardTable rows={leaderboardRows} />
    </main>
  );
}
