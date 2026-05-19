import { GuessDistributionCard } from '../components/stats/GuessDistributionCard';
import { StatTile } from '../components/stats/StatTile';
import { guessDistribution } from '../data/prototypeData';
import type { NavigateToPage } from '../types/routes';

interface StatsPageProps {
  onNavigate: NavigateToPage;
}

export function StatsPage({ onNavigate }: StatsPageProps) {
  return (
    <main className="page stats-page">
      <section className="victory-header">
        <p className="eyebrow">Daily result</p>
        <h1>Victory</h1>
        <p>You completed the character board and quote challenge.</p>
      </section>

      <section className="stats-layout">
        <article className="character-reveal glass-card">
          <div className="portrait-card" aria-hidden="true">
            <span>CL</span>
          </div>
          <span className="pill">Daily Character</span>
          <h2>Cersei Lannister</h2>
          <p>Universe: ASOIAF</p>
          <button className="primary-button" type="button">Share</button>
        </article>

        <div className="stats-stack">
          <section className="stat-grid glass-card" aria-label="Player stats">
            <StatTile label="Played" value="124" />
            <StatTile label="Win %" value="92" />
            <StatTile label="Current Streak" value="12" />
            <StatTile label="Max Streak" value="28" />
          </section>

          <GuessDistributionCard distribution={guessDistribution} />

          <section className="mode-cards">
            <button className="mode-card glass-card" type="button" onClick={() => onNavigate('game')}>
              <span>Play Again</span>
              <strong>ASOIAF Characterdle</strong>
              <small>Restart the character guessing prototype.</small>
            </button>
            <button className="mode-card glass-card" type="button" onClick={() => onNavigate('launcher')}>
              <span>Back to Launcher</span>
              <strong>Daily Hub</strong>
              <small>Return to the ASOIAF launcher screen.</small>
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
