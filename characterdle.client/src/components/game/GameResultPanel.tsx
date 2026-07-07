import { CharacterPortrait } from './CharacterPortrait';
import { GameShareButton } from '../ui/GameShareButton';
import type { GameSharePayload } from '../../lib/gameShare';
import type { CharacterGameStatus } from '../../types/universeGame';

interface GameResultPanelProps {
  answerName: string;
  answerPortraitUrl?: string | null;
  averageGuesses: number | null;
  guessCount: number;
  hintCount: number;
  playCount: number;
  sharePayload?: GameSharePayload | null;
  showHintCount?: boolean;
  showShareButton?: boolean;
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
  answerPortraitUrl = null,
  averageGuesses,
  guessCount,
  hintCount,
  playCount,
  sharePayload = null,
  showHintCount = false,
  showShareButton = true,
  primaryActionLabel,
  primaryTitle = 'Correct',
  onPrimaryAction,
  onSecondaryAction,
  secondaryActionLabel,
  status,
}: GameResultPanelProps) {
  const showPrimaryAction = !!primaryActionLabel && !!onPrimaryAction;
  const showSecondaryAction = !!secondaryActionLabel && !!onSecondaryAction;
  const canShare = showShareButton && !!sharePayload;

  if (status === 'lost') {
    return (
      <section className="result-panel glass-card" aria-label="Answer revealed" data-result-panel="true">
        <div className="result-panel-main">
          <CharacterPortrait
            character={{ displayName: answerName, portraitUrl: answerPortraitUrl }}
            variant="guess"
          />
          <div className="result-answer-copy">
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
        </div>

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
          {canShare && <GameShareButton payload={sharePayload} />}
        </div>
      </section>
    );
  }

  return (
    <section className="result-panel glass-card" aria-label="Correct answer details" data-result-panel="true">
      <div className="result-panel-main">
        <CharacterPortrait
          character={{ displayName: answerName, portraitUrl: answerPortraitUrl }}
          variant="guess"
        />
        <div className="result-answer-copy">
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
      </div>

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
        {canShare && <GameShareButton payload={sharePayload} />}
      </div>
    </section>
  );
}
