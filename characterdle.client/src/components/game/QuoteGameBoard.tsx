import { CharacterPortrait } from './CharacterPortrait';
import { GuestVictorySignupOverlay } from './GuestVictorySignupOverlay';
import { GameShareButton } from '../ui/GameShareButton';
import type {
  CharacterGameStatus,
  CompletedGameStats,
  QuoteGameRow,
} from '../../types/universeGame';

interface QuoteGameBoardProps {
  answerName: string;
  answerPortraitUrl?: string | null;
  completedGameStats: CompletedGameStats;
  currentStreak: number;
  episodeLabel?: string | null;
  gameId: number;
  guessCount: number;
  hintCount: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onViewLeaderboard: () => void;
  primaryActionLabel?: string;
  rows: QuoteGameRow[];
  secondaryActionLabel?: string;
  showHintCount?: boolean;
  showShareButton?: boolean;
  highlightPrimaryAction?: boolean;
  showGuestSignupPrompt?: boolean;
  status: CharacterGameStatus;
  universeId: string;
  universeName: string;
}

function formatAverageGuesses(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export function QuoteGameBoard({
  answerName,
  answerPortraitUrl = null,
  completedGameStats,
  currentStreak,
  episodeLabel = null,
  gameId,
  guessCount,
  hintCount,
  onPrimaryAction,
  onSecondaryAction,
  onViewLeaderboard,
  primaryActionLabel,
  rows,
  secondaryActionLabel,
  showHintCount = false,
  showShareButton = true,
  highlightPrimaryAction = false,
  showGuestSignupPrompt = false,
  status,
  universeId,
  universeName,
}: QuoteGameBoardProps) {
  const showPrimaryAction = !!primaryActionLabel;
  const showSecondaryAction = !!secondaryActionLabel && !!onSecondaryAction;

  return (
    <section className="quote-board" aria-label="Quote game board">
      <section className="quote-history-card glass-card" aria-label="Guess history">
        <div className="quote-history-header">
          <p className="card-kicker">Guess History</p>
          <span>{guessCount} {guessCount === 1 ? 'guess' : 'guesses'}</span>
        </div>

        {rows.length > 0 ? (
          <div className="quote-history-list">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`quote-history-row ${row.isCorrect ? 'is-correct' : 'is-wrong'}`}
              >
                <div className="quote-history-player">
                  <CharacterPortrait
                    character={{ displayName: row.name, portraitUrl: row.portraitUrl ?? null }}
                    variant="history"
                  />
                  <strong>{row.name}</strong>
                </div>
                <span className={`quote-history-status ${row.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                  {row.isCorrect ? 'Correct' : 'Wrong'}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="quote-history-empty">
            No guesses yet.
          </div>
        )}
      </section>

      {status !== 'playing' && (
        <section className="quote-summary-card glass-card" aria-label="Quote game summary" data-result-panel="true">
          <div className="quote-summary-main">
            <CharacterPortrait
              character={{ displayName: answerName, portraitUrl: answerPortraitUrl }}
              variant="guess"
            />
            <div className="quote-summary-copy">
              <p className="card-kicker">{status === 'won' ? 'Speaker Found' : 'Answer Revealed'}</p>
              <h2>{answerName}</h2>
              {episodeLabel && <p className="quote-summary-meta">{episodeLabel}</p>}
            </div>
          </div>

          <div className="quote-summary-stats" aria-label="Quote game statistics">
            <article className="quote-summary-stat">
              <span>Guesses</span>
              <strong>{guessCount}</strong>
            </article>
            {showHintCount ? (
              <article className="quote-summary-stat">
                <span>Hints</span>
                <strong>{hintCount}</strong>
              </article>
            ) : (
              <>
                <article className="quote-summary-stat">
                  <span>Avg Guess</span>
                  <strong>{formatAverageGuesses(completedGameStats.averageGuesses)}</strong>
                </article>
                <article className="quote-summary-stat">
                  <span>Plays</span>
                  <strong>{completedGameStats.playCount}</strong>
                </article>
              </>
            )}
          </div>

          <div className="button-stack quote-summary-actions">
            {showPrimaryAction && (
              <button
                className={highlightPrimaryAction ? 'primary-button quote-summary-button is-random-ready' : 'primary-button quote-summary-button'}
                type="button"
                onClick={onPrimaryAction ?? onViewLeaderboard}
              >
                {primaryActionLabel}
              </button>
            )}
            {showSecondaryAction && (
              <button className="secondary-button quote-summary-button" type="button" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </button>
            )}
            {showShareButton && (
              <GameShareButton
                payload={{
                  gameId,
                  guessCount,
                  hintCount,
                  mode: 'quote',
                  rows,
                  streak: currentStreak,
                  status: status as Extract<CharacterGameStatus, 'won' | 'lost'>,
                  universeId,
                  universeName,
                }}
              />
            )}
          </div>
        </section>
      )}

      {showGuestSignupPrompt && <GuestVictorySignupOverlay />}
    </section>
  );
}
