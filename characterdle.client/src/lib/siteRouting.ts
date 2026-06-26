import { defaultUniverseId, getUniverseById } from '../data/universeCatalog';
import type { GameMode } from '../types/game';

const PRIMARY_SITE_ORIGIN = 'https://characterdle.com';
const LOCALHOST_HOSTNAME = 'localhost';

const universeSubdomainOrigins: Partial<Record<string, string>> = {
  got: 'https://got.characterdle.com',
};

function normalizeHostname(value: string): string {
  return value.trim().replace(/\.+$/, '').toLowerCase();
}

function normalizePathname(value: string): string {
  const trimmedValue = value.trim();
  const normalizedPathname = `/${trimmedValue.replace(/^\/+|\/+$/g, '')}`;

  return normalizedPathname === '//'
    ? '/'
    : normalizedPathname;
}

function getPathSegments(pathname: string): string[] {
  return normalizePathname(pathname).split('/').filter(Boolean);
}

function isPlayableUniverseId(universeId: string): boolean {
  return Boolean(getUniverseById(universeId)?.isPlayable);
}

function isLocalhostEnvironment(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);

  return normalizedHostname === LOCALHOST_HOSTNAME || normalizedHostname.endsWith(`.${LOCALHOST_HOSTNAME}`);
}

function getCurrentProtocol(): string {
  return typeof window === 'undefined'
    ? 'https:'
    : window.location.protocol;
}

function getCurrentPort(): string {
  return typeof window === 'undefined'
    ? ''
    : window.location.port;
}

function buildOrigin(hostname: string, protocol: string, port: string): string {
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}

function getPrimarySiteOriginForHostname(hostname: string): string {
  if (typeof window !== 'undefined' && isLocalhostEnvironment(hostname)) {
    return buildOrigin(LOCALHOST_HOSTNAME, getCurrentProtocol(), getCurrentPort());
  }

  return PRIMARY_SITE_ORIGIN;
}

function getUniversePathPrefix(universeId: string): string {
  return `/${universeId}`;
}

function ensureUniversePath(universeId: string, pathname: string): string {
  const normalizedPathname = normalizePathname(pathname);
  const universePathPrefix = getUniversePathPrefix(universeId).toLowerCase();

  if (
    normalizedPathname.toLowerCase() === universePathPrefix
    || normalizedPathname.toLowerCase().startsWith(`${universePathPrefix}/`)
  ) {
    return normalizedPathname;
  }

  return normalizedPathname === '/'
    ? getUniversePathPrefix(universeId)
    : `${getUniversePathPrefix(universeId)}${normalizedPathname}`;
}

function readLegacyHashPath(hash: string): string | null {
  const normalizedHash = hash.replace(/^#\/?/, '').trim();

  if (!normalizedHash) {
    return null;
  }

  return normalizePathname(normalizedHash);
}

export function getUniverseSubdomainUniverseId(hostname: string): string | null {
  const normalizedHostname = normalizeHostname(hostname);

  if (normalizedHostname === `got.${LOCALHOST_HOSTNAME}`) {
    return 'got';
  }

  for (const [universeId, origin] of Object.entries(universeSubdomainOrigins)) {
    if (!origin) {
      continue;
    }

    if (new URL(origin).hostname.toLowerCase() === normalizedHostname) {
      return universeId;
    }
  }

  return null;
}

export function getUniverseIdFromPathname(pathname: string): string | null {
  const [firstSegment] = getPathSegments(pathname);

  return firstSegment && isPlayableUniverseId(firstSegment)
    ? firstSegment
    : null;
}

export function getDefaultUniverseIdForHostname(hostname: string): string {
  return getUniverseSubdomainUniverseId(hostname) ?? defaultUniverseId;
}

export function getDefaultUniverseIdForLocation(hostname: string, pathname: string): string {
  return getUniverseSubdomainUniverseId(hostname)
    ?? getUniverseIdFromPathname(pathname)
    ?? defaultUniverseId;
}

export function getPrimarySiteOrigin(): string {
  if (typeof window === 'undefined') {
    return PRIMARY_SITE_ORIGIN;
  }

  return getPrimarySiteOriginForHostname(window.location.hostname);
}

export function getSiteOriginForUniverse(_universeId: string): string {
  return getPrimarySiteOrigin();
}

export function getUniverseGamePath(universeId: string, gameMode: GameMode, gameId: number | null): string {
  if (gameMode === 'character' && gameId === null) {
    return getUniversePathPrefix(universeId);
  }

  return gameId === null
    ? `${getUniversePathPrefix(universeId)}/game/${gameMode}`
    : `${getUniversePathPrefix(universeId)}/game/${gameMode}/${gameId}`;
}

export function getUniverseGameUrl(universeId: string, gameMode: GameMode, gameId: number | null): string {
  const gameUrl = new URL(getPrimarySiteOrigin());

  gameUrl.pathname = getUniverseGamePath(universeId, gameMode, gameId);
  gameUrl.search = '';
  gameUrl.hash = '';

  return gameUrl.toString();
}

export function getShareUrlForCurrentLocation(universeId: string): string {
  const shareUrl = new URL(getPrimarySiteOrigin());

  if (typeof window === 'undefined') {
    shareUrl.pathname = getUniverseGamePath(universeId, 'character', null);
    return shareUrl.toString();
  }

  shareUrl.pathname = ensureUniversePath(
    universeId,
    readLegacyHashPath(window.location.hash) ?? window.location.pathname,
  );
  shareUrl.search = window.location.search;
  shareUrl.hash = '';

  return shareUrl.toString();
}

export function getUniverseHostRedirectUrl(
  hostname: string,
  pathname: string,
  search: string,
  hash: string,
): string | null {
  const universeId = getUniverseSubdomainUniverseId(hostname);

  if (!universeId) {
    return null;
  }

  const redirectUrl = new URL(getPrimarySiteOriginForHostname(hostname));

  redirectUrl.pathname = ensureUniversePath(
    universeId,
    readLegacyHashPath(hash) ?? pathname,
  );
  redirectUrl.search = search;
  redirectUrl.hash = '';

  return redirectUrl.toString();
}
