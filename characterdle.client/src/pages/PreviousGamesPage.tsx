import { PreviousGamesGrid } from '../components/history/PreviousGamesGrid';
import { usePreviousUniverseGames } from '../hooks/usePreviousUniverseGames';
import { useUniverse } from '../hooks/useUniverse';
import type { NavigateToPage } from '../types/routes';

interface PreviousGamesPageProps {
  onNavigate: NavigateToPage;
  onOpenGame: (gameId: number | null) => void;
}

export function PreviousGamesPage({ onNavigate, onOpenGame }: PreviousGamesPageProps) {
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = usePreviousUniverseGames(selectedUniverse.id);

  return (
    <main className="page archive-page">
      <section className="archive-shell">
        <div className="archive-header-row">
          <button className="secondary-button archive-nav-button" type="button" onClick={() => onNavigate('launcher')}>
            Home
          </button>
          <div className="archive-title-block">
            <p className="eyebrow">{selectedUniverse.title}</p>
            <h1>Archive</h1>
          </div>
          <button className="primary-button archive-nav-button" type="button" onClick={() => onOpenGame(null)}>
            Current Game
          </button>
        </div>

        <div className="archive-status-bar glass-card" aria-label="Archive status">
          <div>
            <p className="card-kicker">Archive</p>
            <h2>{isLoading ? 'Loading games...' : `${data?.games.length ?? 0} archived boards`}</h2>
            <p className="muted-copy">
              {error
                ? error.message
                : 'Pick any tile to replay a past board. Completed boards turn green after you solve them.'}
            </p>
          </div>
        </div>

        {!isLoading && !error && data && data.games.length > 0 && (
          <PreviousGamesGrid
            games={data.games}
            onOpenGame={onOpenGame}
            universeId={selectedUniverse.id}
            universeTitle={selectedUniverse.title}
          />
        )}

        {!isLoading && !error && data && data.games.length === 0 && (
          <section className="empty-state glass-card" aria-label="No previous games">
            <h2>No previous games found.</h2>
            <p className="muted-copy">Add more seeded dates to the selected universe game table and the archive grid will fill in automatically.</p>
          </section>
        )}
      </section>
    </main>
  );
}
