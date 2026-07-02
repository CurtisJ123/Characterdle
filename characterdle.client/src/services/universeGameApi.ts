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

function createUniverseGameCacheKey(universeId: string, gameId: number | null): string {
  return `${universeId}:${gameId ?? 'current'}`;
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
  return getUniverseGame(universeId, null);
}

export function getUniverseGame(universeId: string, gameId: number | null): Promise<CurrentUniverseGame> {
  const cacheKey = createUniverseGameCacheKey(universeId, gameId);
  const cachedRequest = universeGameRequests.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchUniverseGame(universeId, gameId).catch((error: unknown) => {
    universeGameRequests.delete(cacheKey);
    throw error;
  });

  universeGameRequests.set(cacheKey, request);

  return request;
}

export function getPreviousUniverseGames(universeId: string): Promise<PreviousUniverseGames> {
  const cachedRequest = previousUniverseGamesRequests.get(universeId);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = fetchPreviousUniverseGames(universeId).catch((error: unknown) => {
    previousUniverseGamesRequests.delete(universeId);
    throw error;
  });

  previousUniverseGamesRequests.set(universeId, request);

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

async function fetchUniverseGame(universeId: string, gameId: number | null): Promise<CurrentUniverseGame> {
  if (debugGameLoadDelayMs > 0) {
    await delay(debugGameLoadDelayMs);
  }

  const gamePath = gameId === null ? 'current' : String(gameId);
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/${gamePath}`), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Game request failed with ${response.status}.`);
  }

  const payload = await response.json() as {
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
  };

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

async function fetchPreviousUniverseGames(universeId: string): Promise<PreviousUniverseGames> {
  const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/games/previous`), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Previous games request failed with ${response.status}.`);
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
