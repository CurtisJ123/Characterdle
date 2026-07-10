import type { MouseEvent } from 'react';
import { buildRoutePath } from '../lib/routePaths';
import type { NavigateToPage } from '../types/routes';

interface SupportPageProps {
  onNavigate: NavigateToPage;
}

const supportEmail = 'support@characterdle.com';

export function SupportPage({ onNavigate }: SupportPageProps) {
  function handlePageLinkClick(event: MouseEvent<HTMLAnchorElement>, page: Parameters<NavigateToPage>[0]) {
    event.preventDefault();
    onNavigate(page);
  }

  return (
    <main className="page support-page">
      <section className="glass-card support-hero">
        <div className="support-hero-copy">
          <p className="eyebrow">Support</p>
          <h1>Need help with Characterdle?</h1>
          <p className="muted-copy">
            For account issues, bug reports, leaderboard questions, or general support, email us at{' '}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
          </p>
        </div>

        <div className="support-hero-actions">
          <a
            className="primary-button support-action-button"
            href={`mailto:${supportEmail}?subject=Characterdle%20Support`}
          >
            Email support
          </a>
          <button
            className="secondary-button support-action-button"
            type="button"
            onClick={() => onNavigate('launcher')}
          >
            Back home
          </button>
        </div>
      </section>

      <section className="support-grid" aria-label="Support details">
        <article className="glass-card support-card">
          <p className="card-kicker">Best For</p>
          <h2>What we can help with</h2>
          <ul className="support-list">
            <li>Login, signup, or password reset issues</li>
            <li>Leaderboard, streak, or saved-game questions</li>
            <li>Bug reports, broken pages, or incorrect game data</li>
            <li>Business, press, or feedback requests</li>
          </ul>
        </article>

        <article className="glass-card support-card">
          <p className="card-kicker">Include</p>
          <h2>What to send us</h2>
          <ul className="support-list">
            <li>Your username or email used on the account</li>
            <li>The game mode and game number, if relevant</li>
            <li>What you expected to happen</li>
            <li>Your device, browser, and a screenshot if you have one</li>
          </ul>
        </article>

        <article className="glass-card support-card">
          <p className="card-kicker">Guides</p>
          <h2>Helpful reading</h2>
          <div className="support-policy-links">
            <a
              className="secondary-button support-policy-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'howToPlay', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'howToPlay')}
            >
              How to Play
            </a>
            <a
              className="secondary-button support-policy-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'about', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'about')}
            >
              About Characterdle
            </a>
          </div>
          <p className="muted-copy">Start with the rules page if you are learning the game, then use support for account or bug issues.</p>
        </article>

        <article className="glass-card support-card">
          <p className="card-kicker">Policies</p>
          <h2>Important legal pages</h2>
          <div className="support-policy-links">
            <a
              className="secondary-button support-policy-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'privacyPolicy', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'privacyPolicy')}
            >
              Privacy Policy
            </a>
            <a
              className="secondary-button support-policy-button"
              href={buildRoutePath({ authMode: 'login', gameId: null, gameMode: 'character', page: 'termsOfService', universeId: null })}
              onClick={(event) => handlePageLinkClick(event, 'termsOfService')}
            >
              Terms of Service
            </a>
          </div>
          <p className="muted-copy">Subscription cancellation and refund terms are included inside the Terms of Service page.</p>
        </article>
      </section>
    </main>
  );
}
