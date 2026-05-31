import { hasCompletedCharacterGame } from '../../lib/characterGameProgress';
import type { PreviousUniverseGame } from '../../types/universeGame';

interface PreviousGamesGridProps {
  games: PreviousUniverseGame[];
  onOpenGame: (gameId: number) => void;
  universeId: string;
  universeTitle: string;
}

function formatGameDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function PreviousGamesGrid({ games, onOpenGame, universeId, universeTitle }: PreviousGamesGridProps) {
  return (
    <section className="archive-grid-shell glass-card" aria-label={`Previous ${universeTitle} games`}>
      <div className="archive-grid">
      {games.map((game) => (
        <button
          key={game.id}
          className={`archive-tile ${hasCompletedCharacterGame(universeId, game.id) ? 'is-completed' : 'is-pending'}`}
          type="button"
          aria-label={`Play archived game ${game.id} from ${formatGameDate(game.dateTime)}`}
          title={formatGameDate(game.dateTime)}
          onClick={() => onOpenGame(game.id)}
        >
          <span className="archive-tile-number">{game.id}</span>
        </button>
      ))}
      </div>
    </section>
  );
}
