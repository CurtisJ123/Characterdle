import { useEffect, useRef } from 'react';
import type { GameMode } from '../../types/game';
import './SiteHelpOverlay.css';

interface SiteHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode?: GameMode;
}

export function SiteHelpOverlay({ isOpen, onClose, gameMode = 'character' }: SiteHelpOverlayProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isEpisodeLadder = gameMode === 'episode_ladder';
  useEffect(() => {
    const element = dialog.current;
    if (isOpen && !element?.open) element?.showModal();
    else if (!isOpen && element?.open) element.close();
    return () => { if (element?.open) element.close(); };
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className={`site-help-overlay${isOpen ? ' is-open' : ''}`}
      aria-hidden={!isOpen}
      aria-label={`How to play ${isEpisodeLadder ? 'Episode Ladder' : 'Characterdle'}`}
      onCancel={event => { event.preventDefault(); onClose(); }}
    >
      <button
        className="site-help-overlay-scrim"
        type="button"
        tabIndex={-1}
        aria-label="Close how to play popup"
        onClick={onClose}
      />

      <article className="site-help-panel glass-card">
        <button
          className="site-help-overlay-close"
          type="button"
          tabIndex={isOpen ? 0 : -1}
          autoFocus
          aria-label="Close how to play popup"
          onClick={onClose}
        >
          Close
        </button>

        <div className="site-help-panel-copy">
          <p className="card-kicker">How To Play</p>
          <h2>{isEpisodeLadder ? 'Episode Ladder' : 'Characterdle is a daily Game of Thrones guessing game.'}</h2>
          <p className="muted-copy">
            {isEpisodeLadder
              ? 'Order five Game of Thrones events by episode, earliest to latest. Each event comes from a different episode. You have four attempts per difficulty.'
              : 'Each day you can play a character round and a quote round. Use the clues, compare what you learn from each guess, and try to solve both boards before midnight.'}
          </p>
        </div>

        {isEpisodeLadder ? <>
          <div className="site-help-panel-grid">
            <section className="site-help-panel-section">
              <h3>Arrange the events</h3>
              <ul>
                <li>Drop onto the middle of a card to swap positions. The highlighted card nudges toward your starting position.</li>
                <li>Drop near a card&apos;s top or bottom edge, or between cards, to insert instead. A gap shows where the event will go.</li>
                <li>Drop above or below the board to move an event to the first or last available position. Only unlocked events shift.</li>
                <li>On touch screens, drag using the grip. With a keyboard, focus a card and use Up/Down to swap with the next unlocked card. Press Escape to cancel a drag.</li>
              </ul>
            </section>
            <section className="site-help-panel-section">
              <h3>Read the feedback</h3>
              <ul>
                <li>Green events are correct and locked in place.</li>
                <li>Yellow means one position away. Grey means farther away.</li>
                <li>Flashbacks follow episode and on-screen order, not story chronology.</li>
                <li>Start with Easy and work up to Impossible. Impossible uses five consecutive episodes; easier difficulties spread events farther apart. Completed difficulties turn grey.</li>
              </ul>
            </section>
          </div>
          <section className="site-help-panel-section site-help-panel-section--full">
            <h3>Daily flow</h3>
            <ul>
              <li>Daily and archive difficulties cannot be replayed after a win or loss. Random games are separate practice rounds.</li>
              <li>Signed-in players can read and post comments after completing all five difficulties for that day, win or lose.</li>
            </ul>
          </section>
        </> : <>
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
        </>}
      </article>
    </dialog>
  );
}
