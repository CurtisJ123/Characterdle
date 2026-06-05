import { hasCompletedCharacterGame, hasCompletedQuoteGame } from '../../lib/characterGameProgress';
import type { GameMode } from '../../types/game';
import type { PreviousUniverseGame } from '../../types/universeGame';

interface PreviousGamesGridProps {
  completedGameIds: ReadonlySet<number>;
  games: PreviousUniverseGame[];
  gameMode: GameMode;
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
  completedGameIds,
  games,
  gameMode,
  onOpenGame,
  universeId,
  universeTitle,
}: PreviousGamesGridProps) {
  const modeLabel = gameMode === 'quote' ? 'quote' : 'character';

  return (
    <section className="archive-grid-shell glass-card" aria-label={`Previous ${universeTitle} ${modeLabel} games`}>
      <div className="archive-grid">
      {games.map((game) => {
        const isCompleted = completedGameIds.has(game.id) || (gameMode === 'quote'
          ? hasCompletedQuoteGame(universeId, game.id)
          : hasCompletedCharacterGame(universeId, game.id));

        return (
        <button
          key={game.id}
          className={`archive-tile ${isCompleted ? 'is-completed' : 'is-pending'}`}
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
