import { useLayoutEffect, useRef, type ReactNode } from 'react';
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
  premiumOffer?: ReactNode;
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
  premiumOffer,
}: PreviousGamesGridProps) {
  const modeLabel = gameMode === 'episode_ladder' ? 'Episode Ladder' : gameMode === 'quote' ? 'quote' : 'character';
  const regionRef = useRef<HTMLDivElement>(null);
  const offerRef = useRef<HTMLDivElement>(null);
  const hasPremiumOffer = Boolean(premiumOffer) && games.some((game, index) =>
    game.id !== currentGameId && accessibleGameCount >= 0 && index - 1 >= accessibleGameCount);

  useLayoutEffect(() => {
    const region = regionRef.current;
    const offer = offerRef.current;
    const grid = region?.querySelector<HTMLElement>('.archive-grid');
    if (!hasPremiumOffer || !region || !offer || !grid) return;

    // Clear every playable row, including when the free games wrap on mobile.
    const positionOffer = () => {
      const regionTop = region.getBoundingClientRect().top;
      const freeTiles = grid.querySelectorAll<HTMLElement>('.archive-tile:not(.is-locked)');
      const freeBottom = Math.max(0, ...Array.from(freeTiles, tile => tile.getBoundingClientRect().bottom - regionTop));
      const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
      const top = freeTiles.length ? freeBottom + gap : 0;
      offer.style.top = `${top}px`;
      offer.style.visibility = 'visible';
      region.style.minHeight = `${top + offer.offsetHeight}px`;
    };

    positionOffer();
    const observer = new ResizeObserver(positionOffer);
    observer.observe(grid);
    observer.observe(offer);
    return () => {
      observer.disconnect();
      region.style.removeProperty('min-height');
    };
  }, [hasPremiumOffer, games, accessibleGameCount, currentGameId]);

  return (
    <section className="archive-grid-shell glass-card" aria-label={`${universeTitle} ${modeLabel} games`}>
      <div className="archive-grid-region" ref={regionRef}>
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
            : outcome === 'won-with-hints'
              ? 'archive-tile is-hinted-win'
            : 'archive-tile is-pending';
        const outcomeLabel = gameMode === 'episode_ladder'
          ? outcome === 'won' ? 'Won.' : outcome === 'lost' ? 'Finished without solving.' : 'Not completed.'
          : outcome === 'won-with-hints'
          ? 'Solved with hints. Replay available 30 days after completion.'
          : outcome === 'lost'
            ? 'Gave up. Replay available 30 days after completion.'
            : outcome === 'won' ? 'Won without hints.' : 'Not completed.';
        const resolvedTileClassName = `${tileClassName}${isLocked ? ' is-locked' : ''}`;
        const accessibleGameDescription = isLocked
          ? `Premium required to play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`
          : isCurrentGame
            ? `Play current ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`
            : `Play archived ${modeLabel} game ${game.id} from ${formatGameDate(game.dateTime)}`;

        if (isLocked) {
          return (
            <button key={game.id} className={resolvedTileClassName} type="button"
              aria-label={`${accessibleGameDescription}. ${outcomeLabel}`} title={`Premium required. ${outcomeLabel}`} disabled>
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
            aria-label={`${accessibleGameDescription}. ${outcomeLabel}`}
            title={`${isCurrentGame ? 'Current Game - ' : ''}${formatGameDate(game.dateTime)}. ${outcomeLabel}`}
            onNavigate={() => onOpenGame(gameId)}
          >
            <span className="archive-tile-number">{game.id}</span>
          </RouteLink>
        );
      })}
      </div>
      {hasPremiumOffer && <div className="archive-premium-overlay" ref={offerRef}>{premiumOffer}</div>}
      </div>
    </section>
  );
}
