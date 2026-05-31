import type { CharacterGameStatus } from '../../types/universeGame';

interface CharacterResultPanelProps {
  answerName: string;
  averageGuesses: number | null;
  guessCount: number;
  hintCount: number;
  onContinueToQuote: () => void;
  playCount: number;
  status: Extract<CharacterGameStatus, 'won' | 'lost'>;
}

function formatAverageGuesses(value: number | null): string {
  if (value === null) {
    return 'ERROR';
  }

  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export function CharacterResultPanel({
  answerName,
  averageGuesses,
  guessCount,
  hintCount,
  onContinueToQuote,
  playCount,
  status,
}: CharacterResultPanelProps) {
  if (status === 'lost') {
    return (
      <section className="result-panel glass-card" aria-label="Answer revealed">
        <div>
          <p className="card-kicker">Answer</p>
          <h2>{answerName}</h2>
          <p className="muted-copy">
            You gave up after {guessCount} guess{guessCount === 1 ? '' : 'es'} and {hintCount} hint{hintCount === 1 ? '' : 's'}.
          </p>

          <div className="result-stats-grid" aria-label="Game summary">
            <article className="result-stat-card">
              <span>Your guesses</span>
              <strong>{guessCount}</strong>
            </article>
            <article className="result-stat-card">
              <span>Hints used</span>
              <strong>{hintCount}</strong>
            </article>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="result-panel glass-card" aria-label="Correct answer details">
      <div>
        <p className="card-kicker">Correct</p>
        <h2>{answerName}</h2>
        <p className="muted-copy">
          You solved today&apos;s character in {guessCount} guess{guessCount === 1 ? '' : 'es'}.
        </p>

        <div className="result-stats-grid" aria-label="Game statistics">
          <article className="result-stat-card">
            <span>Your guesses</span>
            <strong>{guessCount}</strong>
          </article>
          <article className="result-stat-card">
            <span>Avg guess</span>
            <strong>{formatAverageGuesses(averageGuesses)}</strong>
          </article>
          <article className="result-stat-card">
            <span>Plays</span>
            <strong>{playCount}</strong>
          </article>
        </div>
      </div>

      <div className="button-stack">
        <button className="primary-button" type="button" onClick={onContinueToQuote}>
          Continue to Quote Game
        </button>
      </div>
    </section>
  );
}
