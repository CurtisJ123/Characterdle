import { PreviousGamesGrid } from '../components/history/PreviousGamesGrid';
import { RouteLink } from '../components/ui/RouteLink';
import { buildRoutePath } from '../lib/routePaths';
import { useAuth } from '../hooks/useAuth';
import { usePreviousUniverseGames } from '../hooks/usePreviousUniverseGames';
import { useUniverseGame } from '../hooks/useUniverseGame';
import { useUniverseGameResults } from '../hooks/useUniverseGameResults';
import { useUniverse } from '../hooks/useUniverse';
import {
  getCharacterGameOutcome,
  getGameProgressOwnerKey,
  getQuoteGameOutcome,
  getRemoteGameOutcome,
} from '../lib/characterGameProgress';
import type { GameMode } from '../types/game';
import type { PremiumAccess } from '../types/premium';
import type { NavigateToPage } from '../types/routes';

interface PreviousGamesPageProps {
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
  premiumAccess: PremiumAccess | null;
  selectedGameMode: GameMode;
}

export function PreviousGamesPage({
  onNavigate,
  onOpenGame,
  onOpenHistory,
  premiumAccess,
  selectedGameMode,
}: PreviousGamesPageProps) {
  const { selectedUniverse } = useUniverse();
  const { session, user } = useAuth();
  const progressOwnerKey = getGameProgressOwnerKey(user?.id);
  const requestScope = user?.id ?? 'guest';
  const { data, error, isLoading } = usePreviousUniverseGames(selectedUniverse.id, session?.access_token ?? null, requestScope);
  const {
    data: currentGame,
    error: currentGameError,
    isLoading: isCurrentGameLoading,
  } = useUniverseGame(
    selectedUniverse.id,
    null,
    session?.access_token ?? null,
    requestScope,
  );
  const { data: gameResults } = useUniverseGameResults(
    session?.access_token ?? null,
    selectedUniverse.id,
    progressOwnerKey,
  );
  const modeLabel = selectedGameMode === 'quote' ? 'Quote' : 'Character';
  const hasFullArchiveAccess = premiumAccess?.fullArchiveAccess === true;
  const archiveLookbackDays = Math.max(premiumAccess?.archiveLookbackDays ?? 3, 0);
  const accessibleGameCount = hasFullArchiveAccess
    ? Number.MAX_SAFE_INTEGER
    : archiveLookbackDays;
  const games = currentGame
    ? [{ id: currentGame.id, dateTime: currentGame.dateTime }, ...(data?.games ?? [])]
    : data?.games ?? [];
  const archiveError = error ?? currentGameError;
  const isArchiveLoading = isLoading || isCurrentGameLoading;
  const gameOutcomes = new Map(
    games.map((game) => {
      const localOutcome = selectedGameMode === 'quote'
        ? getQuoteGameOutcome(progressOwnerKey, selectedUniverse.id, game.id)
        : getCharacterGameOutcome(progressOwnerKey, selectedUniverse.id, game.id);
      const remoteResult = gameResults.find((result) => result.mode === selectedGameMode && result.gameId === game.id);
      const remoteOutcome = remoteResult
        ? getRemoteGameOutcome(remoteResult.status, remoteResult.completedAt)
        : 'pending';

      return [game.id, remoteOutcome !== 'pending' ? remoteOutcome : localOutcome];
    }),
  );

  return (
    <main className="page archive-page">
      <section className="archive-shell">
        <div className="archive-header-row">
          <RouteLink className="secondary-button archive-nav-button" href="/home" onNavigate={() => onNavigate('launcher')}>
            Home
          </RouteLink>
          <div className="archive-title-block">
            <p className="eyebrow">{selectedUniverse.title}</p>
            <h1>{modeLabel} Archive</h1>
          </div>
        </div>

        <div className="archive-status-bar glass-card" aria-label="Archive status">
          <div className="archive-status-copy">
            <p className="card-kicker">{modeLabel} archive</p>
            <h2>{isArchiveLoading ? 'Loading games...' : `${games.length} ${modeLabel.toLowerCase()} boards`}</h2>
            {archiveError && <p className="muted-copy">Unable to load archive.</p>}
          </div>
          <div className="archive-mode-toggle" aria-label="Archive mode">
            <RouteLink
              className={`archive-mode-link${selectedGameMode === 'character' ? ' is-active' : ''}`}
              href={buildRoutePath({ page: 'history', universeId: selectedUniverse.id, gameMode: 'character', gameId: null, authMode: 'login' })}
              aria-current={selectedGameMode === 'character' ? 'page' : undefined}
              onNavigate={() => onOpenHistory('character')}
            >
              Character
            </RouteLink>
            <RouteLink
              className={`archive-mode-link${selectedGameMode === 'quote' ? ' is-active' : ''}`}
              href={buildRoutePath({ page: 'history', universeId: selectedUniverse.id, gameMode: 'quote', gameId: null, authMode: 'login' })}
              aria-current={selectedGameMode === 'quote' ? 'page' : undefined}
              onNavigate={() => onOpenHistory('quote')}
            >
              Quote
            </RouteLink>
          </div>
        </div>

        {!isArchiveLoading && !archiveError && currentGame && games.length > 0 && (
          <PreviousGamesGrid
            accessibleGameCount={accessibleGameCount}
            currentGameId={currentGame.id}
            games={games}
            gameMode={selectedGameMode}
            gameOutcomes={gameOutcomes}
            onOpenGame={(gameId) => onOpenGame(selectedGameMode, gameId)}
            universeTitle={selectedUniverse.title}
            universeId={selectedUniverse.id}
          />
        )}

        {!isArchiveLoading && !archiveError && games.length === 0 && (
          <section className="empty-state glass-card" aria-label="No previous games">
            <h2>No games yet.</h2>
          </section>
        )}
      </section>
    </main>
  );
}
