import type { Announcement } from '../types/announcements';
import type { AppRoute } from '../types/routes';
import { getUniverseById } from '../data/universeCatalog.ts';
import { buildRoutePath } from '../lib/routePaths.ts';

export interface SeoDefinition {
  canonicalUrl: string;
  description: string;
  robots: string;
  structuredData: Record<string, unknown> | null;
  title: string;
}

const SITE_NAME = 'Characterdle';
const SITE_ORIGIN = 'https://characterdle.com';
const INDEX_ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex,nofollow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';


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

export function resolveSeo(route: AppRoute): SeoDefinition {
  const universeTitle = resolveUniverseTitle(route.universeId);
  const canonicalUrl = buildCanonicalUrl(route);

  switch (route.page) {
    case 'notFound':
      return resolveErrorSeo(buildRoutePath(route), 404);
    case 'admin':
      return { canonicalUrl, title: 'Administration | Characterdle', description: 'Characterdle administration.', robots: NOINDEX_ROBOTS, structuredData: null };
    case 'updates':
      return { canonicalUrl, title: 'News & Updates | Characterdle', description: 'The latest Characterdle features, improvements, and announcements.',
        robots: INDEX_ROBOTS, structuredData: null };
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
      const isGotDailyCharacter = route.universeId === 'got' && route.gameMode === 'character' && route.gameId === null;
      const modeLabel = route.gameMode === 'quote' ? 'Quote' : 'Character';
      const archivePrefix = route.gameId ? 'Archive ' : 'Daily ';
      const title = isGotDailyCharacter
        ? 'Game Of Thrones Characterdle'
        : route.gameId
          ? `${universeTitle} ${modeLabel} Game #${route.gameId} | Characterdle`
          : `${archivePrefix}${universeTitle} ${modeLabel} Game | Characterdle`;
      const description = isGotDailyCharacter
        ? 'Play Characterdle, a free daily Game of Thrones character guessing game. Use house, role, season, and status clues. No account required.'
        : route.gameMode === 'quote'
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

export function resolveErrorSeo(pathname: string, status: 404 | 503): SeoDefinition {
  return {
    canonicalUrl: `${SITE_ORIGIN}${pathname}`,
    title: status === 404 ? 'Page not found | Characterdle' : 'Game temporarily unavailable | Characterdle',
    description: status === 404 ? 'This page could not be found.' : 'Please try again shortly.',
    robots: NOINDEX_ROBOTS,
    structuredData: null,
  };
}

export function resolveAnnouncementSeo(post: Announcement): SeoDefinition {
  return {
    title: `${post.title} | Characterdle`, description: post.summary,
    canonicalUrl: `${SITE_ORIGIN}/updates/${encodeURIComponent(post.slug)}`,
    robots: 'index,follow',
    structuredData: { '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.summary, datePublished: post.publishedAt,
      dateModified: post.updatedAt, author: { '@type': 'Organization', name: SITE_NAME } },
  };
}
