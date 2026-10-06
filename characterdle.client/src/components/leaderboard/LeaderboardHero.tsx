import type { ReactNode } from 'react';
import { UserAvatar } from '../ui/UserAvatar';

interface LeaderboardHeroProps {
  displayName: string | null | undefined;
  avatarUrl?: string | null;
  emptyTitle?: string;
  stats: { label: string; value: string | number }[];
  children: ReactNode;
}

export function LeaderboardHero({ displayName, avatarUrl, emptyTitle = 'No ranked players yet', stats, children }: LeaderboardHeroProps) {
  return (
    <section className="leaderboard-hero">
      <article className="champion-card glass-card">
        <div className="champion-avatar-shell">
          <UserAvatar className="champion-avatar" size="hero" avatarUrl={avatarUrl} displayName={displayName ?? '--'} />
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
