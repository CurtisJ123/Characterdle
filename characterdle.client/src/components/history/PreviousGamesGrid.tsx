import lockClosedIcon from '../../assets/lock-closed-heroicons.svg';
import type { StoredGameOutcome } from '../../lib/characterGameProgress';
import type { GameMode } from '../../types/game';
import type { PreviousUniverseGame } from '../../types/universeGame';

interface PreviousGamesGridProps {
  accessibleGameCount: number;
  games: PreviousUniverseGame[];
  gameMode: GameMode;
  gameOutcomes: ReadonlyMap<number, StoredGameOutcome>;
  onOpenGame: (gameId: number) => void;
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
  accessibleGameCount,
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
      {games.map((game, index) => {
        const isLocked = accessibleGameCount >= 0 && index >= accessibleGameCount;
        const outcome = gameOutcomes.get(game.id) ?? 'pending';
        const tileClassName = outcome === 'won'
          ? 'archive-tile is-completed'
          : outcome === 'lost'
            ? 'archive-tile is-given-up'
            : 'archive-tile is-pending';
        const resolvedTileClassName = `${tileClassName}${isLocked ? ' is-locked' : ''}`;
        const accessibleGameDescription = isLocked
          ? `Premium required to play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`
          : `Play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`;

        return (
        <button
          key={game.id}
          className={resolvedTileClassName}
          type="button"
          aria-label={accessibleGameDescription}
          title={isLocked ? 'Premium required' : formatGameDate(game.dateTime)}
          disabled={isLocked}
          onClick={() => onOpenGame(game.id)}
        >
          {isLocked && (
            <span className="archive-tile-lock" aria-hidden="true">
              <img src={lockClosedIcon} alt="" />
            </span>
          )}
          <span className="archive-tile-number">{game.id}</span>
        </button>
        );
      })}
      </div>
    </section>
  );
}
