import { BrandButton } from '../components/layout/BrandButton';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface LandingPageProps {
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

export function LandingPage({ onAuthNavigate, onNavigate }: LandingPageProps) {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Landing navigation">
        <BrandButton onClick={() => onNavigate('landing')} />
        <div>
          <button className="ghost-link" type="button" onClick={() => onAuthNavigate('login')}>
            Sign in
          </button>
          <button className="primary-button" type="button" onClick={() => onNavigate('launcher')}>
            Try without signing up
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Daily character guessing</p>
          <h1>Play the daily challenge.</h1>
          <p>
            Characterdle is a daily guessing game.
            Start with the character board, then continue into the quote round.
          </p>
          <div className="landing-actions">
            <button className="primary-button large-button" type="button" onClick={() => onAuthNavigate('signup')}>
              Create free account
            </button>
            <button className="secondary-button large-button" type="button" onClick={() => onNavigate('launcher')}>
              Try without signing up
            </button>
          </div>
        </div>

        <aside className="landing-preview glass-card" aria-label="Game preview">
          <span className="pill">Daily mode</span>
          <h2>How it works</h2>
          <ol>
            <li>Guess the hidden character.</li>
            <li>Use the attribute clues to narrow it down.</li>
            <li>Beat the board to unlock the quote.</li>
            <li>Finish the run and share your stats.</li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
