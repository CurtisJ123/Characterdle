interface PrototypePathCardProps {
  onPlay: () => void;
  onTestVictory: () => void;
}

export function PrototypePathCard({ onPlay, onTestVictory }: PrototypePathCardProps) {
  return (
    <article className="glass-card play-card">
      <p className="card-kicker">Prototype path</p>
      <h2>Current flow</h2>
      <p className="muted-copy">Character guessing leads into the quote game.</p>
      <div className="button-stack">
        <button className="primary-button" type="button" onClick={onPlay}>
          Play
        </button>
        <button className="secondary-button" type="button" onClick={onTestVictory}>
          Test Victory Screen
        </button>
      </div>
    </article>
  );
}
