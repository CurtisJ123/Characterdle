import type { CSSProperties } from 'react';
import type { Universe } from '../../types/game';

interface UniverseCardProps {
  universe: Universe;
  onPlay: () => void;
}

export function UniverseCard({ universe, onPlay }: UniverseCardProps) {
  const accentStyle = { '--accent': universe.accent } as CSSProperties;
  const cardClassName = [
    'universe-card',
    'glass-card',
    `is-${universe.launchState}`,
    universe.isFeatured ? 'is-featured' : '',
    universe.isPlayable ? 'is-playable' : 'is-disabled',
  ].join(' ');

  return (
    <article className={cardClassName} style={accentStyle} aria-disabled={!universe.isPlayable}>
      <div className="universe-art" aria-hidden="true">
        <span />
      </div>
      {universe.ribbonLabel && (
        <div className="universe-ribbon" aria-hidden="true">
          <span>{universe.ribbonLabel}</span>
        </div>
      )}
      <div className="universe-content">
        <span className="pill">{universe.genre}</span>
        <h2>{universe.title}</h2>
        <p>{universe.description}</p>
        <div className="card-footer">
          <span>{universe.status}</span>
          <button type="button" onClick={onPlay} disabled={!universe.isPlayable}>
            {universe.buttonLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
