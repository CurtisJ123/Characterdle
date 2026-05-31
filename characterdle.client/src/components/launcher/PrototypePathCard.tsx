interface PrototypePathCardProps {
  onPlay: () => void;
  onViewPreviousGames: () => void;
}

export function PrototypePathCard({ onPlay, onViewPreviousGames }: PrototypePathCardProps) {
  return (
    <article className="glass-card play-card">
      <p className="card-kicker">Game flow</p>
      <h2>Current flow</h2>
      <p className="muted-copy">Character guessing leads into the quote game, and previous answers are archived in the history view.</p>
      <div className="button-stack">
        <button className="primary-button" type="button" onClick={onPlay}>
          Play
        </button>
        <button className="secondary-button" type="button" onClick={onViewPreviousGames}>
          Previous Games
        </button>
      </div>
    </article>
  );
}
