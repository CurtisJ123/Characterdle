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
          <p className="eyebrow">A daily lore deduction game</p>
          <h1>Prove you know the realm.</h1>
          <p>
            Characterdle turns fandom knowledge into a clean daily puzzle.
            Start with A Song of Ice and Fire, solve the character board,
            then unlock a quote challenge from the same universe.
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
          <span className="pill">ASOIAF Daily</span>
          <h2>Today&apos;s Path</h2>
          <ol>
            <li>Guess the hidden character.</li>
            <li>Use house, culture, and region clues.</li>
            <li>Beat the board to unlock the quote.</li>
            <li>Finish the run and share your stats.</li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
