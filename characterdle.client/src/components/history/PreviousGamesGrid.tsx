import type { StoredGameOutcome } from '../../lib/characterGameProgress';
import type { GameMode } from '../../types/game';
import type { PreviousUniverseGame } from '../../types/universeGame';

interface PreviousGamesGridProps {
  games: PreviousUniverseGame[];
  gameMode: GameMode;
  gameOutcomes: ReadonlyMap<number, StoredGameOutcome>;
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

export function PreviousGamesGrid({
  games,
  gameMode,
  gameOutcomes,
  onOpenGame,
  universeTitle,
}: PreviousGamesGridProps) {
  const modeLabel = gameMode === 'quote' ? 'quote' : 'character';

  return (
    <section className="archive-grid-shell glass-card" aria-label={`Previous ${universeTitle} ${modeLabel} games`}>
      <div className="archive-grid">
      {games.map((game) => {
        const outcome = gameOutcomes.get(game.id) ?? 'pending';
        const tileClassName = outcome === 'won'
          ? 'archive-tile is-completed'
          : outcome === 'lost'
            ? 'archive-tile is-given-up'
            : 'archive-tile is-pending';

        return (
        <button
          key={game.id}
          className={tileClassName}
          type="button"
          aria-label={`Play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`}
          title={formatGameDate(game.dateTime)}
          onClick={() => onOpenGame(game.id)}
        >
          <span className="archive-tile-number">{game.id}</span>
        </button>
        );
      })}
      </div>
    </section>
  );
}
