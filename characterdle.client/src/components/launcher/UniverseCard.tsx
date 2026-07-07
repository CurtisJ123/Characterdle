import type { CSSProperties } from 'react';
import type { Universe } from '../../types/game';

interface UniverseCardProps {
  universe: Universe;
  onPlay: () => void;
  onPlayQuote?: () => void;
}

export function UniverseCard({ universe, onPlay, onPlayQuote }: UniverseCardProps) {
  const accentStyle = { '--accent': universe.accent } as CSSProperties;
  const cardClassName = [
    'universe-card',
    'glass-card',
    `is-universe-${universe.id}`,
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
        <div className="universe-copy">
          <h2>{universe.title}</h2>
          {universe.description && <p>{universe.description}</p>}
        </div>
        <div className="card-footer">
          <span>{universe.status}</span>
          <div className="card-action-group">
            <button type="button" onClick={onPlay} disabled={!universe.isPlayable}>
              {universe.buttonLabel}
            </button>
            {onPlayQuote && (
              <button className="universe-secondary-button" type="button" onClick={onPlayQuote}>
                Quote
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
