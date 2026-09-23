import type { ReactNode } from 'react';

interface LeaderboardHeroProps {
  displayName: string | null | undefined;
  emptyTitle?: string;
  stats: { label: string; value: string | number }[];
  children: ReactNode;
}

export function LeaderboardHero({ displayName, emptyTitle = 'No ranked players yet', stats, children }: LeaderboardHeroProps) {
  const initials = displayName
    ? displayName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
    : '--';

  return (
    <section className="leaderboard-hero">
      <article className="champion-card glass-card">
        <div className="champion-avatar-shell">
          <div className="champion-avatar" aria-hidden="true">{initials}</div>
        </div>
        <div className="champion-copy">
          <h1>{displayName ?? emptyTitle}</h1>
          <dl className="champion-stats">
            {stats.map(stat => (
              <div className="champion-stat-card" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>
      <aside className="glass-card pulse-card">{children}</aside>
    </section>
  );
}
