import { CharacterGamePage } from './CharacterGamePage';
import { PremiumArchiveGateOverlay } from '../components/game/PremiumArchiveGateOverlay';
import { useRandomUniverseGame } from '../hooks/useRandomUniverseGame';
import { useUniverse } from '../hooks/useUniverse';
import { UniverseGameApiError } from '../services/universeGameApi';
import type { BillingCheckoutPlan } from '../types/billing';
import type { GameMode } from '../types/game';
import type { UniverseStreak } from '../types/leaderboard';
import type { PremiumAccess } from '../types/premium';
import type { NavigateToPage } from '../types/routes';

interface RandomGamePageProps {
  accessToken: string | null;
  currentStreak: number;
  isAuthenticated: boolean;
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
  onOpenRandomGame: (gameMode: GameMode, universeId?: string) => void;
  onStreakUpdated: (streak: UniverseStreak) => void;
  onStartCheckout: (plan: BillingCheckoutPlan) => Promise<void>;
  premiumAccess: PremiumAccess | null;
  selectedGameMode: GameMode;
}

export function RandomGamePage({
  accessToken,
  currentStreak,
  isAuthenticated,
  onNavigate,
  onOpenGame,
  onOpenHistory,
  onOpenRandomGame,
  onStreakUpdated,
  onStartCheckout,
  premiumAccess,
  selectedGameMode,
}: RandomGamePageProps) {
  const { selectedUniverse } = useUniverse();
  const randomGame = useRandomUniverseGame(
    selectedUniverse.id,
    selectedGameMode,
    accessToken,
  );
  const { advanceToNextGame, roundKey, state: randomGameState } = randomGame;
  const { data, error, isLoading } = randomGameState;
  const modeLabel = selectedGameMode === 'quote' ? 'Quote' : 'Character';
  const isPremiumLocked = error instanceof UniverseGameApiError && error.status === 403;

  if (data) {
    return (
      <CharacterGamePage
        key={`${selectedGameMode}:${roundKey}`}
        currentStreak={currentStreak}
        gameStateOverride={randomGameState}
        gameVariant="random"
        onNavigate={onNavigate}
        onOpenGame={onOpenGame}
        onOpenHistory={onOpenHistory}
        onOpenRandomGame={onOpenRandomGame}
        onRefreshRandomGame={advanceToNextGame}
        onStreakUpdated={onStreakUpdated}
        premiumAccess={premiumAccess}
        selectedGameId={null}
        selectedGameMode={selectedGameMode}
      />
    );
  }

  return (
    <main className="page centered-page game-page random-game-page">
      {isPremiumLocked && (
        <PremiumArchiveGateOverlay
          featureLabel="Premium random game"
          gameLabel={modeLabel}
          headline="Subscribe to premium to play random games."
          message="Random Game spins up unlimited practice rounds directly from the live character and quote database without affecting daily stats, archives, or streaks."
          onGoHome={() => onNavigate('launcher')}
          onStartCheckout={isAuthenticated ? onStartCheckout : undefined}
        />
      )}

      <section className="glass-card random-route-shell">
        <p className="eyebrow">Universe: {selectedUniverse.title}</p>
        <h1>Random {modeLabel} Game</h1>
        {isLoading ? (
          <p className="muted-copy">
            Loading a fresh random {modeLabel.toLowerCase()} round now.
          </p>
        ) : isPremiumLocked ? (
          <p className="muted-copy">
            Premium members can spin up unlimited practice rounds pulled straight from the database any time.
          </p>
        ) : error ? (
          <>
            <p className="error-copy random-route-status">{error.message}</p>
            <div className="random-route-actions">
              <button className="secondary-button" type="button" onClick={() => onNavigate('launcher')}>
                Back Home
              </button>
              <button className="primary-button" type="button" onClick={() => onOpenGame(selectedGameMode, null)}>
                Current Game
              </button>
            </div>
          </>
        ) : (
          <p className="muted-copy">
            Pulling a fresh random {modeLabel.toLowerCase()} round from the source data now.
          </p>
        )}
      </section>
    </main>
  );
}
