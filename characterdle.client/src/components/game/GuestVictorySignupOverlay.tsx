import { useEffect, useState } from 'react';
import { GuestVictorySignupPrompt } from './GuestVictorySignupPrompt';

export function GuestVictorySignupOverlay() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDismissed(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className="guest-victory-signup-overlay"
      role="dialog"
      aria-modal="false"
      aria-label="Sign up to save your win"
    >
      <button
        className="guest-victory-signup-overlay-scrim"
        type="button"
        aria-label="Close sign up popup"
        onClick={() => setIsDismissed(true)}
      />
      <div className="guest-victory-signup-overlay-panel">
        <button
          className="guest-victory-signup-overlay-close"
          type="button"
          aria-label="Close sign up popup"
          onClick={() => setIsDismissed(true)}
        >
          Close
        </button>
        <GuestVictorySignupPrompt />
      </div>
    </div>
  );
}
