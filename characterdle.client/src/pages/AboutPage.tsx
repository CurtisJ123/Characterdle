import './InformationalPage.css';
import { RouteLink } from '../components/ui/RouteLink';
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
            Characterdle is a Wordle-inspired Game of Thrones guessing game. Play the{' '}
            <RouteLink href="/got">daily character game</RouteLink>, identify a quote&apos;s speaker,
            or put events in order in Episode Ladder. Today&apos;s games are free to play without an account.
          </p>
        </div>

        <div className="informational-hero-actions">
          <RouteLink className="primary-button informational-action-button" href="/got">
            Play today&apos;s game
          </RouteLink>
          <RouteLink className="secondary-button informational-action-button" href="/how-to-play" onNavigate={() => onNavigate('howToPlay')}>
            Read how to play
          </RouteLink>
        </div>
      </section>

      <section className="informational-grid" aria-label="About Characterdle">
        <article className="glass-card informational-card">
          <p className="card-kicker">Daily Format</p>
          <h2>Three daily games</h2>
          <p>
            Character mode asks you to identify a hidden character from clues. Quote mode asks you to
            remember who said a line from the show.{' '}
            <RouteLink href="/got/game/episode_ladder">Episode Ladder</RouteLink> gives you five events to
            arrange by episode, with four attempts on each of five difficulties from Easy to Impossible.
          </p>
        </article>

        <article className="glass-card informational-card">
          <p className="card-kicker">The Wordle Connection</p>
          <h2>Characters, not letters</h2>
          <p>
            Wordle tells you whether letters belong in a hidden word and whether they are in the right
            positions. Characterdle compares whole characters instead: their gender, species, houses,
            roles, seasons, and status. Each guess helps narrow down who you are looking for, rather
            than how to spell their name.
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
            All three modes have archives for earlier daily games. Premium unlocks the full archive and
            unlimited random practice, separate from daily progress and leaderboard scores.
          </p>
        </article>
      </section>
    </main>
  );
}
