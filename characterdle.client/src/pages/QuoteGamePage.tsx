import { useUniverse } from '../hooks/useUniverse';
import type { NavigateToPage } from '../types/routes';

interface QuoteGamePageProps {
  onNavigate: NavigateToPage;
}

export function QuoteGamePage({ onNavigate }: QuoteGamePageProps) {
  const { selectedUniverse } = useUniverse();

  return (
    <main className="page quote-page">
      <section className="game-hero">
        <p className="eyebrow">Universe: {selectedUniverse.title}</p>
        <h1>Who said it?</h1>
        <p>Identify the correct speaker.</p>
      </section>

      <section className="quote-card glass-card" aria-label="Quote challenge">
        <span className="quote-mark" aria-hidden="true">"</span>
        <blockquote>When you play the game of thrones, you win or you die.</blockquote>
        <span className="quote-glow" aria-hidden="true" />
      </section>

      <section className="quote-form" aria-label="Submit a quote guess">
        <label>
          <span>Character guess</span>
          <input type="text" defaultValue="Example Guess" />
        </label>
        <p className="error-copy">That is incorrect. Try again.</p>
        <div className="quote-actions">
          <button className="secondary-button large-button" type="button">Hint</button>
          <button className="primary-button large-button" type="button" onClick={() => onNavigate('launcher')}>
            Complete Quote Round
          </button>
        </div>
      </section>

      <section className="previous-guesses" aria-label="Previous guesses">
        <h2>Previous Guesses</h2>
        <article className="previous-card">
          <span className="miss-icon" aria-hidden="true">x</span>
          <div>
            <strong>Example Guess</strong>
            <p>Previous attempt</p>
          </div>
          <span className="status-badge">Incorrect</span>
        </article>
        <div className="waiting-slot">Waiting for next guess...</div>
      </section>
    </main>
  );
}
