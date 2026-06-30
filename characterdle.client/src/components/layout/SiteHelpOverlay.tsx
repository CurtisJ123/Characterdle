import { useEffect } from 'react';

interface SiteHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SiteHelpOverlay({ isOpen, onClose }: SiteHelpOverlayProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div
      className={`site-help-overlay${isOpen ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-hidden={!isOpen}
      aria-label="How to play Characterdle"
    >
      <button
        className="site-help-overlay-scrim"
        type="button"
        tabIndex={isOpen ? 0 : -1}
        aria-label="Close how to play popup"
        onClick={onClose}
      />

      <article className="site-help-panel glass-card">
        <button
          className="site-help-overlay-close"
          type="button"
          tabIndex={isOpen ? 0 : -1}
          aria-label="Close how to play popup"
          onClick={onClose}
        >
          Close
        </button>

        <div className="site-help-panel-copy">
          <p className="card-kicker">How To Play</p>
          <h2>Characterdle is a daily Game of Thrones guessing game.</h2>
          <p className="muted-copy">
            Each day you can play a character round and a quote round. Use the clues,
            compare what you learn from each guess, and try to solve both boards before midnight.
          </p>
        </div>

        <div className="site-help-panel-grid">
          <section className="site-help-panel-section">
            <h3>Character game</h3>
            <ul>
              <li>Guess the hidden Game of Thrones character by typing a name and submitting it.</li>
              <li>Each row compares your guess across gender, species, house, role, debut season, last season, and status.</li>
              <li>Green means the attribute matches exactly. Yellow means it is close or partially correct.</li>
              <li>Use hints if you need help, but hinted rounds do not count toward ranked stats.</li>
            </ul>
          </section>

          <section className="site-help-panel-section">
            <h3>Quote game</h3>
            <ul>
              <li>Read the quote and guess who said it in the show.</li>
              <li>Hints reveal extra information like season, role, and the first letter of the speaker.</li>
              <li>Winning daily rounds helps your leaderboard position and profile stats when you are signed in.</li>
            </ul>
          </section>
        </div>

        <section className="site-help-panel-section site-help-panel-section--full">
          <h3>Daily flow</h3>
          <ul>
            <li>Play today&apos;s Game of Thrones character game at <strong>Characterdle</strong>.</li>
            <li>Check the archive to replay older boards.</li>
            <li>Use the leaderboard and profile page to track wins, plays, completion, and average guesses.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
