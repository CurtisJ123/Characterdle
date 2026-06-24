import { universes } from '../data/universeCatalog';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { MiniLeaderboardCard } from '../components/launcher/MiniLeaderboardCard';
import { UserProfileCard } from '../components/launcher/UserProfileCard';
import { UniverseCard } from '../components/launcher/UniverseCard';
import { useUniverse } from '../hooks/useUniverse';
import { getUniverseGameUrl, isUniverseHostedOnCurrentHostname, universeHasDedicatedHost } from '../lib/siteRouting';
import type { GameMode } from '../types/game';
import type { NavigateToPage } from '../types/routes';
import type { UserProfile } from '../types/user';

interface LauncherPageProps {
  authError: Error | null;
  isUserLoading: boolean;
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null) => void;
  user: UserProfile | null;
}

export function LauncherPage({ authError, isUserLoading, onNavigate, onOpenGame, user }: LauncherPageProps) {
  const { selectedUniverse, setSelectedUniverseId } = useUniverse();
  const { data: leaderboardData, error: leaderboardError, isLoading: isLeaderboardLoading } = useLeaderboard(
    selectedUniverse.id,
    user?.id ?? null,
  );

  function handleOpenUniverseGame(universeId: string, gameMode: GameMode) {
    const selectedUniverse = universes.find((universe) => universe.id === universeId);

    if (!selectedUniverse?.isPlayable) {
      return;
    }

    if (
      typeof window !== 'undefined'
      && universeHasDedicatedHost(universeId)
      && !isUniverseHostedOnCurrentHostname(universeId, window.location.hostname)
    ) {
      window.location.assign(getUniverseGameUrl(universeId, gameMode, null));
      return;
    }

    setSelectedUniverseId(universeId);
    onOpenGame(gameMode, null);
  }

  return (
    <main className="page page-launcher">
      <section className="hero-section">
        <p className="eyebrow">{user ? 'Welcome back' : 'Choose a universe'}</p>
        <h1>Choose Your Universe</h1>
      </section>

      <section className="launcher-grid" aria-label="Launcher dashboard">
        <div className={`universe-grid ${universes.length === 1 ? 'single-universe' : ''}`}>
          {universes.map((universe) => (
            <UniverseCard
              key={universe.id}
              universe={universe}
              onPlay={() => handleOpenUniverseGame(universe.id, 'character')}
              onPlayQuote={universe.isPlayable ? () => handleOpenUniverseGame(universe.id, 'quote') : undefined}
            />
          ))}
        </div>

        <aside className="dashboard-rail" aria-label="Player snapshot">
          <UserProfileCard error={authError} isLoading={isUserLoading} user={user} />
          <MiniLeaderboardCard
            error={leaderboardError}
            isLoading={isLeaderboardLoading}
            rows={leaderboardData?.rows ?? []}
            onViewAll={() => onNavigate('leaderboard')}
          />
        </aside>
      </section>
    </main>
  );
}
