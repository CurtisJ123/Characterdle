const DEFAULT_IMAGE_URL = 'https://characterdle.com/android-chrome-512x512.png';
const NOINDEX_ROBOTS = 'noindex,nofollow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const IS_STAGING_BUILD = import.meta.env.VITE_DEPLOYMENT_ENVIRONMENT?.trim().toLowerCase() === 'staging';

export interface SeoDefinition {
  canonicalUrl: string;
  description: string;
  robots: string;
  structuredData: Record<string, unknown> | null;
  title: string;
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

export function applyPageSeo(seo: SeoDefinition) {
    const robots = IS_STAGING_BUILD || window.location.hostname.startsWith('staging.') || import.meta.env.DEV ? NOINDEX_ROBOTS : seo.robots;

    document.title = seo.title;

    ensureMeta('meta[name="description"]', 'name', 'description').setAttribute('content', seo.description);
    ensureMeta('meta[name="robots"]', 'name', 'robots').setAttribute('content', robots);
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
}
