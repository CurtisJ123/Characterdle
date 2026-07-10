import './InformationalPage.css';
import type { NavigateToPage } from '../types/routes';

interface AboutPageProps {
  onNavigate: NavigateToPage;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <main className="page informational-page">
      <section className="glass-card informational-hero">
        <div className="informational-hero-copy">
          <p className="eyebrow">About</p>
          <h1>What Characterdle is built to be.</h1>
          <p className="muted-copy">
            Characterdle is a daily browser game built around Game of Thrones memory, deduction,
            and replayability. Each day players can solve a character board and a quote board,
            compare results with friends, and track progress through archives, profiles, and leaderboards.
          </p>
        </div>

        <div className="informational-hero-actions">
          <button className="primary-button informational-action-button" type="button" onClick={() => onNavigate('launcher')}>
            Play today&apos;s game
          </button>
          <button className="secondary-button informational-action-button" type="button" onClick={() => onNavigate('howToPlay')}>
            Read how to play
          </button>
        </div>
      </section>

      <section className="informational-grid" aria-label="About Characterdle">
        <article className="glass-card informational-card">
          <p className="card-kicker">Daily Format</p>
          <h2>Two Game Modes</h2>
          <p>
            The main daily experience is split between a character guessing board and a quote guessing board.
            The character mode rewards deduction across attributes like house, role, seasons, and status.
            The quote mode rewards memory of iconic dialogue, speakers, and episode context.
          </p>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Why Game Of Thrones</p>
          <h2>A universe with depth</h2>
          <p>
            Game of Thrones works well for a daily guessing format because characters can be compared through
            relationships, factions, roles, and story timing, while quotes add a second mode with a very
            different kind of challenge.
          </p>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Player Progress</p>
          <h2>Stats that carry over</h2>
          <p>
            Signed-in players can track wins, average guesses, completion, streaks, and leaderboard standing.
            Guests can still play, but creating an account makes results portable across devices and gives the
            site a consistent player history.
          </p>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">Archive And Practice</p>
          <h2>More than one board</h2>
          <p>
            Characterdle includes archives for previous daily rounds and separate premium practice games that pull
            random content from the live database without changing daily stats. That keeps the site useful even
            after a player has finished today&apos;s official boards.
          </p>
        </article>
      </section>
    </main>
  );
}
