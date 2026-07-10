import { useEffect } from 'react';
import { getUniverseById } from '../../data/universeCatalog';
import { buildRoutePath } from '../../lib/routePaths';
import type { AppRoute } from '../../types/routes';

const SITE_NAME = 'Characterdle';
const SITE_ORIGIN = 'https://characterdle.com';
const DEFAULT_IMAGE_URL = `${SITE_ORIGIN}/android-chrome-512x512.png`;
const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex,nofollow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';

interface SeoDefinition {
  canonicalUrl: string;
  description: string;
  robots: string;
  structuredData: Record<string, unknown> | null;
  title: string;
}

function buildCanonicalUrl(route: AppRoute): string {
  return `${SITE_ORIGIN}${buildRoutePath(route)}`;
}

function resolveUniverseTitle(universeId: string | null): string {
  return getUniverseById(universeId ?? '')?.title ?? 'Game of Thrones';
}

function resolveStructuredData(route: AppRoute, title: string, description: string, canonicalUrl: string): Record<string, unknown> | null {
  switch (route.page) {
    case 'landing':
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url: canonicalUrl,
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_ORIGIN,
        },
      };
    case 'about':
      return {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: title,
        description,
        url: canonicalUrl,
      };
    case 'howToPlay':
      return {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'HowTo',
            name: title,
            description,
            url: canonicalUrl,
            step: [
              { '@type': 'HowToStep', name: 'Guess a character or quote', text: 'Open the daily character or quote board and submit your first guess.' },
              { '@type': 'HowToStep', name: 'Read the clues', text: 'Use attribute matches, season arrows, and quote hints to narrow the answer.' },
              { '@type': 'HowToStep', name: 'Finish the board', text: 'Solve the round, then check your results, streak, archive progress, and leaderboard standing.' },
            ],
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Do I need an account to play?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. Guests can play, but accounts are required for saved stats, streak tracking, and leaderboard placement.',
                },
              },
              {
                '@type': 'Question',
                name: 'What happens when I use hints?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Hints help complete the board, but hinted rounds are treated differently from clean ranked solves.',
                },
              },
            ],
          },
        ],
      };
    case 'support':
      return {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: title,
        description,
        url: canonicalUrl,
      };
    case 'history':
    case 'leaderboard':
      return {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonicalUrl,
      };
    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url: canonicalUrl,
      };
  }
}

function resolveSeo(route: AppRoute): SeoDefinition {
  const universeTitle = resolveUniverseTitle(route.universeId);
  const canonicalUrl = buildCanonicalUrl(route);

  switch (route.page) {
    case 'landing': {
      const title = 'Characterdle | Daily Game of Thrones Character and Quote Guessing Game';
      const description = 'Play Characterdle, a daily Game of Thrones guessing game with character and quote rounds, public archives, streaks, and leaderboards.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'launcher': {
      const title = 'Choose Your Universe | Characterdle';
      const description = 'Start today\'s Game of Thrones Characterdle boards, compare game modes, and jump into the archive or leaderboard from the Characterdle home page.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'game': {
      const modeLabel = route.gameMode === 'quote' ? 'Quote' : 'Character';
      const archivePrefix = route.gameId ? 'Archive ' : 'Daily ';
      const title = route.gameId
        ? `${universeTitle} ${modeLabel} Game #${route.gameId} | Characterdle`
        : `${archivePrefix}${universeTitle} ${modeLabel} Game | Characterdle`;
      const description = route.gameMode === 'quote'
        ? `Play the ${route.gameId ? 'archived' : 'daily'} ${universeTitle} quote guessing game in Characterdle and identify who said the line before using all your hints.`
        : `Play the ${route.gameId ? 'archived' : 'daily'} ${universeTitle} character guessing game in Characterdle and deduce the hidden answer through attributes, seasons, and status clues.`;
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'history': {
      const modeLabel = route.gameMode === 'quote' ? 'Quote' : 'Character';
      const title = `${universeTitle} ${modeLabel} Archive | Characterdle`;
      const description = `Browse archived ${universeTitle.toLowerCase()} ${route.gameMode} boards in Characterdle and replay older daily rounds from the public archive.`;
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'leaderboard': {
      const title = `${universeTitle} Leaderboard | Characterdle`;
      const description = `See the current ${universeTitle} Characterdle leaderboard, streak standings, win totals, and top performers across daily character and quote games.`;
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'premium': {
      const title = 'Characterdle Premium | Full Archive, Random Practice, Ad-Free Play';
      const description = 'See Characterdle Premium pricing, archive access, random practice games, streak protection, and supporter perks before upgrading.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'support': {
      const title = 'Characterdle Support | Contact, Account Help, and Bug Reports';
      const description = 'Contact Characterdle support for account help, leaderboard questions, bug reports, and general site support.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'about': {
      const title = 'About Characterdle | Daily Game of Thrones Guessing Game';
      const description = 'Learn what Characterdle is, why it focuses on Game of Thrones, how daily boards work, and what makes the archive and leaderboard useful over time.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'howToPlay': {
      const title = 'How to Play Characterdle | Rules for Character and Quote Games';
      const description = 'Read the Characterdle rules for daily character boards, quote boards, hints, archives, leaderboard progress, and common player questions.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'privacyPolicy': {
      const title = 'Characterdle Privacy Policy';
      const description = 'Read the Characterdle Privacy Policy covering accounts, gameplay data, support requests, cookies, local storage, and advertising disclosures.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'termsOfService': {
      const title = 'Characterdle Terms of Service';
      const description = 'Review the Characterdle Terms of Service, including subscription terms, cancellation details, refund policy language, and acceptable use rules.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
    case 'auth': {
      const title = route.authMode === 'signup'
        ? 'Create Your Characterdle Account'
        : route.authMode === 'forgotPassword'
          ? 'Recover Your Characterdle Password'
          : route.authMode === 'resetPassword'
            ? 'Reset Your Characterdle Password'
            : 'Log In to Characterdle';
      const description = 'Access your Characterdle account to save stats, streaks, archive progress, and leaderboard results.';
      return {
        canonicalUrl,
        description,
        robots: NOINDEX_ROBOTS,
        structuredData: null,
        title,
      };
    }
    case 'profile': {
      const title = 'Your Characterdle Profile';
      const description = 'View your Characterdle profile, saved stats, recent results, and personal streak progress.';
      return {
        canonicalUrl,
        description,
        robots: NOINDEX_ROBOTS,
        structuredData: null,
        title,
      };
    }
    case 'random': {
      const modeLabel = route.gameMode === 'quote' ? 'Quote' : 'Character';
      const title = `${universeTitle} Random ${modeLabel} Practice | Characterdle`;
      const description = `Play a random ${universeTitle} ${route.gameMode} practice round in Characterdle without affecting daily archives or leaderboard results.`;
      return {
        canonicalUrl,
        description,
        robots: NOINDEX_ROBOTS,
        structuredData: null,
        title,
      };
    }
    default: {
      const title = 'Characterdle';
      const description = 'A daily Game of Thrones character and quote guessing game.';
      return {
        canonicalUrl,
        description,
        robots: INDEX_ROBOTS,
        structuredData: resolveStructuredData(route, title, description, canonicalUrl),
        title,
      };
    }
  }
}

function ensureMeta(selector: string, attributeName: string, attributeValue: string): HTMLMetaElement {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }

  return element;
}

function ensureCanonicalLink(): HTMLLinkElement {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  return element;
}

function ensureStructuredDataScript(): HTMLScriptElement {
  let element = document.head.querySelector<HTMLScriptElement>('script[data-characterdle-seo="page-jsonld"]');

  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.setAttribute('data-characterdle-seo', 'page-jsonld');
    document.head.appendChild(element);
  }

  return element;
}

export function SeoManager({ route }: { route: AppRoute }) {
  useEffect(() => {
    const seo = resolveSeo(route);

    document.title = seo.title;

    ensureMeta('meta[name="description"]', 'name', 'description').setAttribute('content', seo.description);
    ensureMeta('meta[name="robots"]', 'name', 'robots').setAttribute('content', seo.robots);
    ensureMeta('meta[property="og:title"]', 'property', 'og:title').setAttribute('content', seo.title);
    ensureMeta('meta[property="og:description"]', 'property', 'og:description').setAttribute('content', seo.description);
    ensureMeta('meta[property="og:url"]', 'property', 'og:url').setAttribute('content', seo.canonicalUrl);
    ensureMeta('meta[property="og:image"]', 'property', 'og:image').setAttribute('content', DEFAULT_IMAGE_URL);
    ensureMeta('meta[name="twitter:title"]', 'name', 'twitter:title').setAttribute('content', seo.title);
    ensureMeta('meta[name="twitter:description"]', 'name', 'twitter:description').setAttribute('content', seo.description);
    ensureMeta('meta[name="twitter:url"]', 'name', 'twitter:url').setAttribute('content', seo.canonicalUrl);
    ensureMeta('meta[name="twitter:image"]', 'name', 'twitter:image').setAttribute('content', DEFAULT_IMAGE_URL);

    ensureCanonicalLink().setAttribute('href', seo.canonicalUrl);

    const structuredDataScript = ensureStructuredDataScript();
    structuredDataScript.textContent = seo.structuredData
      ? JSON.stringify(seo.structuredData)
      : '';
  }, [route]);

  return null;
}
