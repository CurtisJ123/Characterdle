import type { CSSProperties } from 'react';
import type { Universe } from '../../types/game';

interface UniverseCardProps {
  universe: Universe;
  onPlay: () => void;
}

export function UniverseCard({ universe, onPlay }: UniverseCardProps) {
  const accentStyle = { '--accent': universe.accent } as CSSProperties;

  return (
    <article className="universe-card glass-card" style={accentStyle}>
      <div className="universe-art" aria-hidden="true">
        <span />
      </div>
      <div className="universe-content">
        <span className="pill">{universe.genre}</span>
        <h2>{universe.title}</h2>
        <p>{universe.description}</p>
        <div className="card-footer">
          <span>{universe.status}</span>
          <button type="button" onClick={onPlay}>Play</button>
        </div>
      </div>
    </article>
  );
}
