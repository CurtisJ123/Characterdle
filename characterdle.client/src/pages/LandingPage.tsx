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
          <p className="eyebrow">Daily character game</p>
          <h1>Guess the character.</h1>
          <p>Play today&apos;s board.</p>
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
          <span className="pill">Play</span>
          <h2>How to play</h2>
          <ol>
            <li>Guess the hidden character.</li>
            <li>Use the clues.</li>
            <li>Check the archive or leaderboard.</li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
