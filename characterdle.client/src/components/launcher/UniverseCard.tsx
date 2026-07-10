import type { MouseEvent } from 'react';
import type { CSSProperties } from 'react';
import type { Universe } from '../../types/game';

interface UniverseCardProps {
  playHref: string;
  quoteHref?: string;
  universe: Universe;
  onPlay: () => void;
  onPlayQuote?: () => void;
}

export function UniverseCard({ playHref, quoteHref, universe, onPlay, onPlayQuote }: UniverseCardProps) {
  const accentStyle = { '--accent': universe.accent } as CSSProperties;
  const cardClassName = [
    'universe-card',
    'glass-card',
    `is-universe-${universe.id}`,
    `is-${universe.launchState}`,
    universe.isFeatured ? 'is-featured' : '',
    universe.isPlayable ? 'is-playable' : 'is-disabled',
  ].join(' ');

  function handleClick(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
    event.preventDefault();
    action();
  }

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
            {universe.isPlayable ? (
              <a href={playHref} onClick={(event) => handleClick(event, onPlay)}>
                {universe.buttonLabel}
              </a>
            ) : (
              <button type="button" disabled>
                {universe.buttonLabel}
              </button>
            )}
            {onPlayQuote && quoteHref && (
              <a
                className="universe-secondary-button"
                href={quoteHref}
                onClick={(event) => handleClick(event, onPlayQuote)}
              >
                Quote
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
