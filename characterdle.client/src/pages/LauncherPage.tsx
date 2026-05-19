import { asoiafUniverse, leaderboardRows } from '../data/prototypeData';
import { MiniLeaderboardCard } from '../components/launcher/MiniLeaderboardCard';
import { PrototypePathCard } from '../components/launcher/PrototypePathCard';
import { StreakCard } from '../components/launcher/StreakCard';
import { UniverseCard } from '../components/launcher/UniverseCard';
import type { NavigateToPage } from '../types/routes';

interface LauncherPageProps {
  onNavigate: NavigateToPage;
}

export function LauncherPage({ onNavigate }: LauncherPageProps) {
  return (
    <main className="page page-launcher">
      <section className="hero-section">
        <p className="eyebrow">Daily character deduction</p>
        <h1>Choose Your Universe</h1>
        <p>
          The prototype is focused on A Song of Ice and Fire. Beat the character
          board to unlock the quote round, then test the final victory screen.
        </p>
      </section>

      <section className="launcher-grid" aria-label="Launcher dashboard">
        <div className="universe-grid single-universe">
          <UniverseCard universe={asoiafUniverse} onPlay={() => onNavigate('game')} />
        </div>

        <aside className="dashboard-rail" aria-label="Player snapshot">
          <StreakCard />
          <MiniLeaderboardCard rows={leaderboardRows} onViewAll={() => onNavigate('leaderboard')} />
          <PrototypePathCard onPlay={() => onNavigate('game')} onTestVictory={() => onNavigate('stats')} />
        </aside>
      </section>
    </main>
  );
}
