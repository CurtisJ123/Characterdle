import { LandingPage } from '../pages/LandingPage';
import { AboutPage } from '../pages/AboutPage';
import { HowToPlayPage } from '../pages/HowToPlayPage';
import { SupportPage } from '../pages/SupportPage';
import { LegalDocumentPage } from '../pages/LegalDocumentPage';
import { PremiumPage } from '../pages/PremiumPage';
import { UniverseCard } from '../components/launcher/UniverseCard';
import { SiteFooter } from '../components/layout/SiteFooter';
import { UpdateArticle, UpdatesHeading, UpdatesList } from '../components/updates/UpdateContent';
import { universes } from '../data/universeCatalog';
import type { AppRoute } from '../types/routes';
import type { PublicUpdates } from './publicUpdates';
import { resolveSeo } from './metadata';

const noop = () => {};
const noopAsync = async () => {};

// Only public, account-independent presentation is rendered here. The browser
// mounts the existing app; games, comments, auth and billing still use their APIs.
export function PublicPage({ route, updates, error }: {
  route: AppRoute; updates?: PublicUpdates; error?: string;
}) {
  if (route.page === 'landing') return <LandingPage isAuthLoading onAuthNavigate={noop} onNavigate={noop} />;
  let content;
  switch (route.page) {
    case 'about': content = <AboutPage onNavigate={noop} />; break;
    case 'howToPlay': content = <HowToPlayPage onNavigate={noop} />; break;
    case 'support': content = <SupportPage onNavigate={noop} />; break;
    case 'privacyPolicy': case 'termsOfService': content = <LegalDocumentPage page={route.page} onNavigate={noop} />; break;
    case 'premium': content = <PremiumPage isAuthenticated={false} isPremiumLoading onAuthNavigate={noop}
      onNavigate={noop} onOpenBillingPortal={noopAsync} onStartCheckout={noopAsync} premiumAccess={null} />; break;
    case 'launcher': content = <main className="page page-launcher">
      <section className="hero-section"><p className="eyebrow">Choose a universe</p><h1>Choose Your Universe</h1></section>
      <section className="launcher-grid"><div className="universe-grid">{universes.map(universe =>
        <UniverseCard key={universe.id} universe={universe} playHref={`/${universe.id}`}
          quoteHref={universe.isPlayable ? `/${universe.id}/game/quote` : undefined}
          onPlay={noop} onPlayQuote={universe.isPlayable ? noop : undefined} />)}</div></section>
    </main>; break;
    case 'updates': content = <main className="page updates-page">
      {route.postSlug ? <><a className="updates-back" href="/updates">All updates</a>
        {updates?.post ? <UpdateArticle post={updates.post} /> : <section className="glass-card updates-article">
          <h1>{error ? 'Update unavailable' : 'News & Updates'}</h1><p>{error ?? 'Loading update...'}</p></section>}</>
        : <><UpdatesHeading />{updates?.list && <UpdatesList items={updates.list.items} />}
          {error && <p role="status">{error}</p>}</>}
    </main>; break;
    default: {
      const seo = resolveSeo(route);
      const isGotDailyCharacter = route.page === 'game' && route.universeId === 'got'
        && route.gameMode === 'character' && route.gameId === null;
      if (isGotDailyCharacter) {
        content = <main className="page centered-page game-page">
          <section className="game-hero">
            <p className="eyebrow">Universe: Game of Thrones</p>
            <h1>Daily Character Game</h1>
          </section>
          <p id="prerender-status" className="muted-copy" role="status">Loading interactive features...</p>
          <noscript>Enable JavaScript to play. <a href="/how-to-play">Read the rules</a>.</noscript>
        </main>;
        break;
      }
      content = <main className="page informational-page"><section className="glass-card informational-hero">
        <div className="informational-hero-copy"><h1>{seo.title.split(' | ')[0]}</h1><p className="muted-copy">{seo.description}</p>
          {route.page === 'game' && <p className="muted-copy">{route.gameMode === 'episode_ladder'
            ? 'Order five events from earliest to latest. Correct positions lock in place, and each difficulty gives you four attempts.'
            : route.gameMode === 'quote'
            ? 'Read the quote and guess the Game of Thrones character who said it. Hints can help you narrow down the speaker.'
            : 'Guess a Game of Thrones character. Compare identity, houses, roles, seasons, and status to narrow down the answer.'}</p>}
          <p id="prerender-status" className="muted-copy" role="status">Loading interactive features...</p>
          <noscript>Enable JavaScript to play and load live results. You can still read the rules and browse public information.</noscript>
        </div>
        <nav className="informational-hero-actions" aria-label="Explore Characterdle">
          <a className="secondary-button" href="/how-to-play">How to play</a>
          <a className="secondary-button" href="/got">Character game</a>
          <a className="secondary-button" href="/got/game/quote">Quote game</a>
          <a className="secondary-button" href="/got/game/episode_ladder">Episode Ladder</a>
          <a className="secondary-button" href="/got/archive/character">Character archive</a>
          <a className="secondary-button" href="/got/archive/quote">Quote archive</a>
          <a className="secondary-button" href="/got/archive/episode_ladder">Episode Ladder archive</a>
        </nav>
      </section></main>;
    }
  }
  return <div className="app-shell">
    <header className="site-header"><nav className="header-inner prerender-nav" aria-label="Main navigation">
      <a className="brand-button" href="/"><img className="brand-mark" src="/brand/characterdle-logo-small.webp" width={42} height={42} alt="" />Characterdle</a>
      <div className="main-nav"><a className="nav-button" href="/home">Home</a>
        <a className="nav-button" href="/got/archive/character">Archive</a>
        <a className="nav-button" href="/got/leaderboard">Leaderboard</a><a className="nav-button" href="/updates">Updates</a></div>
    </nav></header>
    {content}<SiteFooter />
  </div>;
}
