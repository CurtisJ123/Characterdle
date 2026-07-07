import type {
  CompletedGameStats,
  CurrentUniverseGame,
  PreviousUniverseGames,
  UniverseAttributeDefinition,
  UniverseCharacterOption,
  UniverseAttributeValue,
  UniverseCharacter,
} from '../types/universeGame';
import { buildApiUrl } from '../lib/runtimeConfig';

const universeGameRequests = new Map<string, Promise<CurrentUniverseGame>>();
const previousUniverseGamesRequests = new Map<string, Promise<PreviousUniverseGames>>();
const universeCharacterOptionsRequests = new Map<string, Promise<UniverseCharacterOption[]>>();
const debugGameLoadDelayMs = import.meta.env.DEV
  ? parseDebugGameLoadDelay(import.meta.env.VITE_DEBUG_GAME_LOAD_DELAY_MS)
  : 0;

export class UniverseGameApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UniverseGameApiError';
    this.status = status;
  }
}

interface UniverseCharacterPayload {
  id: number;
  displayName: string;
  aliases: string[];
  attributes: Record<string, UniverseAttributeValue>;
  portraitUrl?: string | null;
}

interface UniverseCharacterOptionPayload {
  id: number;
  displayName: string;
  portraitUrl: string;
}

interface UniverseAttributeDefinitionPayload {
  key: string;
  label: string;
  kind: UniverseAttributeDefinition['kind'];
  emptyLabel?: string | null;
  falseLabel?: string | null;
  helpText?: string | null;
  trueLabel?: string | null;
}

interface CompletedGameStatsPayload {
  averageGuessSampleSize: number;
  averageGuesses: number | null;
  playCount: number;
}

interface CurrentUniverseGamePayload {
  id: number;
  dateTime: string;
  universeId: string;
  universeName: string;
  characterStats: CompletedGameStatsPayload;
  quoteStats: CompletedGameStatsPayload | null;
  attributeDefinitions: UniverseAttributeDefinitionPayload[];
  answerCharacter: UniverseCharacterPayload;
  quotePrompt: {
    characterId: number;
    episodeNumber: number;
    episodeTitle?: string | null;
    id: number | string;
    seasonNumber: number;
    text: string;
  } | null;
  characters: UniverseCharacterPayload[];
}

function createUniverseGameCacheKey(universeId: string, gameId: number | null): string {
  return `${universeId}:${gameId ?? 'current'}`;
}

function createScopedCacheKey(baseCacheKey: string, requestScope: string): string {
  return `${baseCacheKey}:${requestScope}`;
}

function parseDebugGameLoadDelay(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function getCurrentUniverseGame(universeId: string): Promise<CurrentUniverseGame> {
  return getUniverseGame(universeId, null, null, 'guest');
}

export function getUniverseGame(
  universeId: string,
  gameId: number | null,
  accessToken: string | null = null,
  requestScope = 'guest',
): Promise<CurrentUniverseGame> {
  const cacheKey = createScopedCacheKey(createUniverseGameCacheKey(universeId, gameId), requestScope);
  const cachedRequest = universeGameRequests.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchUniverseGame(universeId, gameId, accessToken).catch((error: unknown) => {
    universeGameRequests.delete(cacheKey);
    throw error;
  });

  universeGameRequests.set(cacheKey, request);

  return request;
}

export function getPreviousUniverseGames(
  universeId: string,
  accessToken: string | null = null,
  requestScope = 'guest',
): Promise<PreviousUniverseGames> {
  const cacheKey = createScopedCacheKey(universeId, requestScope);
  const cachedRequest = previousUniverseGamesRequests.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchPreviousUniverseGames(universeId, accessToken).catch((error: unknown) => {
    previousUniverseGamesRequests.delete(cacheKey);
    throw error;
  });

  previousUniverseGamesRequests.set(cacheKey, request);

  return request;
}

export function getUniverseCharacterAvatarOptions(universeId: string): Promise<UniverseCharacterOption[]> {
  const cachedRequest = universeCharacterOptionsRequests.get(universeId);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchUniverseCharacterAvatarOptions(universeId).catch((error: unknown) => {
    universeCharacterOptionsRequests.delete(universeId);
    throw error;
  });

  universeCharacterOptionsRequests.set(universeId, request);

  return request;
}

export async function getRandomUniverseGame(
  universeId: string,
  mode: 'character' | 'quote',
  accessToken: string | null = null,
): Promise<CurrentUniverseGame> {
  const response = await fetch(
    buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/random${mode === 'quote' ? '/quote' : ''}`),
    {
      headers: createApiHeaders(accessToken),
    },
  );

  if (!response.ok) {
    await throwUniverseGameApiError(response, `Random game request failed with ${response.status}.`);
  }

  const payload = await response.json() as CurrentUniverseGamePayload;
  return mapCurrentUniverseGame(payload);
}

function createApiHeaders(accessToken: string | null): HeadersInit {
  return accessToken
    ? {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }
    : {
      Accept: 'application/json',
    };
}

async function throwUniverseGameApiError(response: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage;

  try {
    const payload = await response.json() as {
      detail?: string;
      message?: string;
      title?: string;
    };

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      message = payload.detail.trim();
    } else if (typeof payload.message === 'string' && payload.message.trim()) {
      message = payload.message.trim();
    } else if (typeof payload.title === 'string' && payload.title.trim()) {
      message = payload.title.trim();
    }
  } catch {
    // Fall back to the default message when the response is not JSON.
  }

  throw new UniverseGameApiError(message, response.status);
}

async function fetchUniverseGame(
  universeId: string,
  gameId: number | null,
  accessToken: string | null,
): Promise<CurrentUniverseGame> {
  if (debugGameLoadDelayMs > 0) {
    await delay(debugGameLoadDelayMs);
  }

  const gamePath = gameId === null ? 'current' : String(gameId);
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/${gamePath}`), {
    headers: createApiHeaders(accessToken),
  });

  if (!response.ok) {
    await throwUniverseGameApiError(response, `Game request failed with ${response.status}.`);
  }

  const payload = await response.json() as CurrentUniverseGamePayload;
  return mapCurrentUniverseGame(payload);
}

async function fetchPreviousUniverseGames(universeId: string, accessToken: string | null): Promise<PreviousUniverseGames> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/previous`), {
    headers: createApiHeaders(accessToken),
  });

  if (!response.ok) {
    await throwUniverseGameApiError(response, `Previous games request failed with ${response.status}.`);
  }

  const payload = await response.json() as {
    universeId: string;
    universeName: string;
    attributeDefinitions: UniverseAttributeDefinitionPayload[];
    games: Array<{
      id: number;
      dateTime: string;
    }>;
  };

  return {
    universeId: payload.universeId,
    universeName: payload.universeName,
    attributeDefinitions: payload.attributeDefinitions.map(mapAttributeDefinition),
    games: payload.games,
  };
}

async function fetchUniverseCharacterAvatarOptions(universeId: string): Promise<UniverseCharacterOption[]> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/characters`), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Character avatar options request failed with ${response.status}.`);
  }

  const payload = await response.json() as UniverseCharacterOptionPayload[];

  return payload.map((option) => ({
    displayName: option.displayName,
    id: option.id,
    portraitUrl: option.portraitUrl,
  }));
}

function mapAttributeDefinition(payload: UniverseAttributeDefinitionPayload): UniverseAttributeDefinition {
  return {
    emptyLabel: payload.emptyLabel ?? null,
    falseLabel: payload.falseLabel ?? null,
    helpText: payload.helpText ?? null,
    key: payload.key,
    kind: payload.kind,
    label: payload.label,
    trueLabel: payload.trueLabel ?? null,
  };
}

function mapCharacter(payload: UniverseCharacterPayload): UniverseCharacter {
  return {
    aliases: payload.aliases,
    attributes: payload.attributes,
    displayName: payload.displayName,
    id: payload.id,
    portraitUrl: payload.portraitUrl ?? null,
  };
}

function mapCompletedGameStats(payload: CompletedGameStatsPayload): CompletedGameStats {
  return {
    averageGuessSampleSize: payload.averageGuessSampleSize,
    averageGuesses: payload.averageGuesses,
    playCount: payload.playCount,
  };
}

function mapCurrentUniverseGame(payload: CurrentUniverseGamePayload): CurrentUniverseGame {
  return {
    attributeDefinitions: payload.attributeDefinitions.map(mapAttributeDefinition),
    answerCharacter: mapCharacter(payload.answerCharacter),
    characterStats: mapCompletedGameStats(payload.characterStats),
    dateTime: payload.dateTime,
    characters: payload.characters.map(mapCharacter),
    id: payload.id,
    quotePrompt: payload.quotePrompt
      ? {
        characterId: payload.quotePrompt.characterId,
        episodeNumber: payload.quotePrompt.episodeNumber,
        episodeTitle: payload.quotePrompt.episodeTitle ?? null,
        id: String(payload.quotePrompt.id),
        seasonNumber: payload.quotePrompt.seasonNumber,
        text: payload.quotePrompt.text,
      }
      : null,
    quoteStats: payload.quoteStats ? mapCompletedGameStats(payload.quoteStats) : null,
    universeId: payload.universeId,
    universeName: payload.universeName,
  };
}
