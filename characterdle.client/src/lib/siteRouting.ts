import { defaultUniverseId } from '../data/universeCatalog';
import type { GameMode } from '../types/game';

const PRIMARY_SITE_ORIGIN = 'https://characterdle.com';
const LOCALHOST_HOSTNAME = 'localhost';

const universeSubdomainOrigins: Partial<Record<string, string>> = {
  got: 'https://got.characterdle.com',
};

function normalizeHostname(value: string): string {
  return value.trim().replace(/\.+$/, '').toLowerCase();
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

export function getDefaultUniverseIdForHostname(hostname: string): string {
  return getUniverseSubdomainUniverseId(hostname) ?? defaultUniverseId;
}

export function getSiteOriginForUniverse(universeId: string): string {
  if (typeof window !== 'undefined' && isLocalhostEnvironment(window.location.hostname)) {
    const protocol = getCurrentProtocol();
    const port = getCurrentPort();

    return universeId === 'got'
      ? buildOrigin(`got.${LOCALHOST_HOSTNAME}`, protocol, port)
      : buildOrigin(LOCALHOST_HOSTNAME, protocol, port);
  }

  return universeSubdomainOrigins[universeId] ?? PRIMARY_SITE_ORIGIN;
}

export function universeHasDedicatedHost(universeId: string): boolean {
  return typeof universeSubdomainOrigins[universeId] === 'string';
}

export function isUniverseHostedOnCurrentHostname(universeId: string, hostname: string): boolean {
  return normalizeHostname(new URL(getSiteOriginForUniverse(universeId)).hostname) === normalizeHostname(hostname);
}

export function getUniverseGameUrl(universeId: string, gameMode: GameMode, gameId: number | null): string {
  const gameUrl = new URL(getSiteOriginForUniverse(universeId));

  if (universeId === 'got' && gameMode === 'character' && gameId === null) {
    return gameUrl.toString();
  }

  gameUrl.pathname = gameId === null
    ? `/game/${gameMode}`
    : `/game/${gameMode}/${gameId}`;
  gameUrl.search = '';
  gameUrl.hash = '';

  return gameUrl.toString();
}

export function getShareUrlForCurrentLocation(universeId: string): string {
  const shareUrl = new URL(getSiteOriginForUniverse(universeId));

  if (typeof window === 'undefined') {
    return shareUrl.toString();
  }

  shareUrl.pathname = window.location.pathname;
  shareUrl.search = window.location.search;
  shareUrl.hash = '';

  return shareUrl.toString();
}
