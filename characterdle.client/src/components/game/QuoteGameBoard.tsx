import { CharacterPortrait } from './CharacterPortrait';
import type {
  CharacterGameStatus,
  CompletedGameStats,
  QuoteGameRow,
} from '../../types/universeGame';

interface QuoteGameBoardProps {
  answerName: string;
  answerPortraitUrl?: string | null;
  completedGameStats: CompletedGameStats;
  episodeLabel?: string | null;
  guessCount: number;
  hintCount: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onViewLeaderboard: () => void;
  primaryActionLabel?: string;
  rows: QuoteGameRow[];
  secondaryActionLabel?: string;
  showHintCount?: boolean;
  status: CharacterGameStatus;
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
  episodeLabel = null,
  guessCount,
  hintCount,
  onPrimaryAction,
  onSecondaryAction,
  onViewLeaderboard,
  primaryActionLabel,
  rows,
  secondaryActionLabel,
  showHintCount = false,
  status,
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

          {(showPrimaryAction || showSecondaryAction) && (
            <div className="button-stack quote-summary-actions">
              {showPrimaryAction && (
                <button
                  className="primary-button quote-summary-button"
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
            </div>
          )}
        </section>
      )}
    </section>
  );
}
