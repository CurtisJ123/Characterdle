import type { CSSProperties } from 'react';
import type { GuessDistributionItem } from '../../types/game';

interface GuessDistributionCardProps {
  distribution: GuessDistributionItem[];
}

export function GuessDistributionCard({ distribution }: GuessDistributionCardProps) {
  return (
    <section className="distribution-card glass-card" aria-label="Guess distribution">
      <h2>Guess Distribution</h2>
      {distribution.map((item) => (
        <div className="distribution-row" key={item.guess}>
          <span>{item.guess}</span>
          <div className="bar-track">
            <span
              className={`bar-fill ${item.tone}`}
              style={{ '--bar-width': `${item.width}%` } as CSSProperties}
            >
              {item.count}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
