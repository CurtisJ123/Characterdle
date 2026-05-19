interface PrototypeControlsProps {
  onBeatCharacterGame: () => void;
  onTestVictory: () => void;
}

export function PrototypeControls({ onBeatCharacterGame, onTestVictory }: PrototypeControlsProps) {
  return (
    <section className="prototype-controls glass-card" aria-label="Prototype controls">
      <div>
        <p className="card-kicker">Prototype controls</p>
        <h2>Simulate the win path</h2>
        <p className="muted-copy">Use these until real answer validation is connected to Supabase.</p>
      </div>
      <div className="button-stack">
        <button className="primary-button" type="button" onClick={onBeatCharacterGame}>
          Beat Character Game
        </button>
        <button className="secondary-button" type="button" onClick={onTestVictory}>
          Test Victory Screen
        </button>
      </div>
    </section>
  );
}
