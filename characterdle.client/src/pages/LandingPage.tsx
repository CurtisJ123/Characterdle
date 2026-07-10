import type { MouseEvent } from 'react';
import { BrandButton } from '../components/layout/BrandButton';
import { SiteFooter } from '../components/layout/SiteFooter';
import { buildRoutePath } from '../lib/routePaths';
import type { AuthMode, NavigateToPage } from '../types/routes';

interface LandingPageProps {
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

export function LandingPage({ onAuthNavigate, onNavigate }: LandingPageProps) {
  function handleAuthLinkClick(event: MouseEvent<HTMLAnchorElement>, mode: AuthMode) {
    event.preventDefault();
    onAuthNavigate(mode);
  }

  function handlePageLinkClick(event: MouseEvent<HTMLAnchorElement>, page: Parameters<NavigateToPage>[0]) {
    event.preventDefault();
    onNavigate(page);
  }

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Landing navigation">
        <BrandButton onClick={() => onNavigate('landing')} />
        <div>
          <a
            className="ghost-link"
            href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'auth', universeId: null })}
            onClick={(event) => handleAuthLinkClick(event, 'login')}
          >
            Sign in
          </a>
          <a
            className="primary-button"
            href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'launcher', universeId: null })}
            onClick={(event) => handlePageLinkClick(event, 'launcher')}
          >
            Try without signing up
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Daily character game</p>
          <h1>Guess the character.</h1>
          <p>Play today&apos;s board.</p>
          <div className="landing-actions">
            <a
              className="primary-button large-button"
              href={buildRoutePath({ authMode: 'signup', gameId: null, gameMode: 'character', page: 'auth', universeId: null })}
              onClick={(event) => handleAuthLinkClick(event, 'signup')}
            >
              Create free account
            </a>
            <a
              className="secondary-button large-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'launcher', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'launcher')}
            >
              Try without signing up
            </a>
          </div>
        </div>

        <aside className="landing-preview" aria-label="Game preview">
          <span className="pill">Play</span>
          <h2>How to play</h2>
          <ol>
            <li>Guess the hidden character.</li>
            <li>Use the clues.</li>
            <li>Check the archive or leaderboard.</li>
          </ol>
          <div className="landing-preview-links">
            <a
              className="secondary-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'howToPlay', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'howToPlay')}
            >
              Full rules
            </a>
            <a
              className="ghost-link landing-preview-text-link"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'about', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'about')}
            >
              About Characterdle
            </a>
          </div>
        </aside>
      </section>

      <SiteFooter onNavigate={onNavigate} />
    </main>
  );
}
