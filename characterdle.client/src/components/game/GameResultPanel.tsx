import type { CharacterGameStatus } from '../../types/universeGame';

interface GameResultPanelProps {
  answerName: string;
  averageGuesses: number | null;
  guessCount: number;
  hintCount: number;
  playCount: number;
  showHintCount?: boolean;
  primaryActionLabel?: string;
  primaryTitle?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  status: Extract<CharacterGameStatus, 'won' | 'lost'>;
}

function formatAverageGuesses(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export function GameResultPanel({
  answerName,
  averageGuesses,
  guessCount,
  hintCount,
  playCount,
  showHintCount = false,
  primaryActionLabel,
  primaryTitle = 'Correct',
  onPrimaryAction,
  onSecondaryAction,
  secondaryActionLabel,
  status,
}: GameResultPanelProps) {
  const showPrimaryAction = !!primaryActionLabel && !!onPrimaryAction;
  const showSecondaryAction = !!secondaryActionLabel && !!onSecondaryAction;

  if (status === 'lost') {
    return (
      <section className="result-panel glass-card" aria-label="Answer revealed">
        <div>
          <p className="card-kicker">Game Over</p>
          <h2>{answerName}</h2>

          <div className="result-stats-grid" aria-label="Game summary">
            <article className="result-stat-card">
              <span>Guesses</span>
              <strong>{guessCount}</strong>
            </article>
            <article className="result-stat-card">
              <span>Hints</span>
              <strong>{hintCount}</strong>
            </article>
          </div>
        </div>

        {(showPrimaryAction || showSecondaryAction) && (
          <div className="button-stack">
            {showPrimaryAction && (
              <button className="primary-button" type="button" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </button>
            )}
            {showSecondaryAction && (
              <button className="secondary-button" type="button" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="result-panel glass-card" aria-label="Correct answer details">
      <div>
        <p className="card-kicker">{primaryTitle}</p>
        <h2>{answerName}</h2>

        <div className="result-stats-grid" aria-label="Game statistics">
          <article className="result-stat-card">
            <span>Guesses</span>
            <strong>{guessCount}</strong>
          </article>
          {showHintCount ? (
            <article className="result-stat-card">
              <span>Hints</span>
              <strong>{hintCount}</strong>
            </article>
          ) : (
            <>
              <article className="result-stat-card">
                <span>Avg guess</span>
                <strong>{formatAverageGuesses(averageGuesses)}</strong>
              </article>
              <article className="result-stat-card">
                <span>Plays</span>
                <strong>{playCount}</strong>
              </article>
            </>
          )}
        </div>
      </div>

      {(showPrimaryAction || showSecondaryAction) && (
        <div className="button-stack">
          {showPrimaryAction && (
            <button className="primary-button" type="button" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </button>
          )}
          {showSecondaryAction && (
            <button className="secondary-button" type="button" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
