import { leaderboardRows } from '../data/prototypeData';
import { universes } from '../data/universeCatalog';
import { MiniLeaderboardCard } from '../components/launcher/MiniLeaderboardCard';
import { PrototypePathCard } from '../components/launcher/PrototypePathCard';
import { UserProfileCard } from '../components/launcher/UserProfileCard';
import { UniverseCard } from '../components/launcher/UniverseCard';
import { useUniverse } from '../hooks/useUniverse';
import type { NavigateToPage } from '../types/routes';
import type { UserProfile } from '../types/user';

interface LauncherPageProps {
  authError: Error | null;
  isUserLoading: boolean;
  onNavigate: NavigateToPage;
  user: UserProfile | null;
}

export function LauncherPage({ authError, isUserLoading, onNavigate, user }: LauncherPageProps) {
  const { setSelectedUniverseId } = useUniverse();

  function handlePlayUniverse(universeId: string) {
    const selectedUniverse = universes.find((universe) => universe.id === universeId);

    if (!selectedUniverse?.isPlayable) {
      return;
    }

    setSelectedUniverseId(universeId);
    onNavigate('game');
  }

  return (
    <main className="page page-launcher">
      <section className="hero-section">
        <p className="eyebrow">
          {user ? `Welcome, ${user.displayName}` : 'Daily character game'}
        </p>
        <h1>Choose Your Universe</h1>
        <p>
          The character game flow is shared across universes.
          Complete the character round to unlock the quote round.
        </p>
      </section>

      <section className="launcher-grid" aria-label="Launcher dashboard">
        <div className={`universe-grid ${universes.length === 1 ? 'single-universe' : ''}`}>
          {universes.map((universe) => (
            <UniverseCard key={universe.id} universe={universe} onPlay={() => handlePlayUniverse(universe.id)} />
          ))}
        </div>

        <aside className="dashboard-rail" aria-label="Player snapshot">
          <UserProfileCard error={authError} isLoading={isUserLoading} user={user} />
          <MiniLeaderboardCard rows={leaderboardRows} onViewAll={() => onNavigate('leaderboard')} />
          <PrototypePathCard
            onPlay={() => onNavigate('game')}
            onViewPreviousGames={() => onNavigate('history')}
          />
        </aside>
      </section>
    </main>
  );
}
