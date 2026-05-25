import { asoiafUniverse, leaderboardRows } from '../data/prototypeData';
import { MiniLeaderboardCard } from '../components/launcher/MiniLeaderboardCard';
import { PrototypePathCard } from '../components/launcher/PrototypePathCard';
import { UserProfileCard } from '../components/launcher/UserProfileCard';
import { UniverseCard } from '../components/launcher/UniverseCard';
import type { NavigateToPage } from '../types/routes';
import type { UserProfile } from '../types/user';

interface LauncherPageProps {
  authError: Error | null;
  isUserLoading: boolean;
  onNavigate: NavigateToPage;
  user: UserProfile | null;
}

export function LauncherPage({ authError, isUserLoading, onNavigate, user }: LauncherPageProps) {
  return (
    <main className="page page-launcher">
      <section className="hero-section">
        <p className="eyebrow">
          {user ? `Welcome, ${user.displayName}` : 'Daily character game'}
        </p>
        <h1>Choose Your Universe</h1>
        <p>
          The current build is focused on one universe.
          Complete the character round to unlock the quote round.
        </p>
      </section>

      <section className="launcher-grid" aria-label="Launcher dashboard">
        <div className="universe-grid single-universe">
          <UniverseCard universe={asoiafUniverse} onPlay={() => onNavigate('game')} />
        </div>

        <aside className="dashboard-rail" aria-label="Player snapshot">
          <UserProfileCard error={authError} isLoading={isUserLoading} user={user} />
          <MiniLeaderboardCard rows={leaderboardRows} onViewAll={() => onNavigate('leaderboard')} />
          <PrototypePathCard onPlay={() => onNavigate('game')} onTestVictory={() => onNavigate('stats')} />
        </aside>
      </section>
    </main>
  );
}
