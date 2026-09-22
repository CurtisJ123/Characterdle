import lockClosedIcon from '../../assets/lock-closed-heroicons.svg';
import { RouteLink } from '../ui/RouteLink';
import { buildRoutePath } from '../../lib/routePaths';
import type { StoredGameOutcome } from '../../lib/characterGameProgress';
import type { GameMode } from '../../types/game';
import type { PreviousUniverseGame } from '../../types/universeGame';

interface PreviousGamesGridProps {
  accessibleGameCount: number;
  currentGameId: number;
  games: PreviousUniverseGame[];
  gameMode: GameMode;
  gameOutcomes: ReadonlyMap<number, StoredGameOutcome>;
  onOpenGame: (gameId: number | null) => void;
  universeTitle: string;
  universeId: string;
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
  currentGameId,
  games,
  gameMode,
  gameOutcomes,
  onOpenGame,
  universeTitle,
  universeId,
}: PreviousGamesGridProps) {
  const modeLabel = gameMode === 'quote' ? 'quote' : 'character';

  return (
    <section className="archive-grid-shell glass-card" aria-label={`${universeTitle} ${modeLabel} games`}>
      <div className="archive-grid">
      {games.map((game, index) => {
        const isCurrentGame = game.id === currentGameId;
        const archiveIndex = isCurrentGame ? -1 : index - 1;
        const isLocked = !isCurrentGame && accessibleGameCount >= 0 && archiveIndex >= accessibleGameCount;
        const outcome = gameOutcomes.get(game.id) ?? 'pending';
        const tileClassName = outcome === 'won'
          ? 'archive-tile is-completed'
          : outcome === 'lost'
            ? 'archive-tile is-given-up'
            : 'archive-tile is-pending';
        const resolvedTileClassName = `${tileClassName}${isLocked ? ' is-locked' : ''}`;
        const accessibleGameDescription = isLocked
          ? `Premium required to play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`
          : isCurrentGame
            ? `Play current ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`
            : `Play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`;

        if (isLocked) {
          return (
            <button key={game.id} className={resolvedTileClassName} type="button"
              aria-label={accessibleGameDescription} title="Premium required" disabled>
              <span className="archive-tile-lock" aria-hidden="true">
                <img src={lockClosedIcon} alt="" />
              </span>
              <span className="archive-tile-number">{game.id}</span>
            </button>
          );
        }

        const gameId = isCurrentGame ? null : game.id;
        return (
          <RouteLink
            key={game.id}
            className={resolvedTileClassName}
            href={buildRoutePath({ page: 'game', universeId, gameMode, gameId, authMode: 'login' })}
            aria-label={accessibleGameDescription}
            title={isCurrentGame ? `Current Game - ${formatGameDate(game.dateTime)}` : formatGameDate(game.dateTime)}
            onNavigate={() => onOpenGame(gameId)}
          >
            <span className="archive-tile-number">{game.id}</span>
          </RouteLink>
        );
      })}
      </div>
    </section>
  );
}
