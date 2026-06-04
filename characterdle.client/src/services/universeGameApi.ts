import type {
  CurrentUniverseGame,
  PreviousUniverseGames,
  UniverseAttributeDefinition,
  UniverseAttributeValue,
  UniverseCharacter,
} from '../types/universeGame';

const universeGameRequests = new Map<string, Promise<CurrentUniverseGame>>();
const previousUniverseGamesRequests = new Map<string, Promise<PreviousUniverseGames>>();

interface UniverseCharacterPayload {
  id: number;
  displayName: string;
  aliases: string[];
  attributes: Record<string, UniverseAttributeValue>;
  portraitUrl?: string | null;
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

function createUniverseGameCacheKey(universeId: string, gameId: number | null): string {
  return `${universeId}:${gameId ?? 'current'}`;
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

async function fetchUniverseGame(universeId: string, gameId: number | null): Promise<CurrentUniverseGame> {
  const gamePath = gameId === null ? 'current' : String(gameId);
  const response = await fetch(`/api/universes/${encodeURIComponent(universeId)}/games/${gamePath}`, {
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
    attributeDefinitions: UniverseAttributeDefinitionPayload[];
    answerCharacter: UniverseCharacterPayload;
    quotePrompt: {
      characterId: number;
      episodeNumber: number;
      id: number | string;
      seasonNumber: number;
      text: string;
    } | null;
    characters: UniverseCharacterPayload[];
  };

  return {
    attributeDefinitions: payload.attributeDefinitions.map(mapAttributeDefinition),
    answerCharacter: mapCharacter(payload.answerCharacter),
    dateTime: payload.dateTime,
    characters: payload.characters.map(mapCharacter),
    id: payload.id,
    quotePrompt: payload.quotePrompt
      ? {
        characterId: payload.quotePrompt.characterId,
        episodeNumber: payload.quotePrompt.episodeNumber,
        id: String(payload.quotePrompt.id),
        seasonNumber: payload.quotePrompt.seasonNumber,
        text: payload.quotePrompt.text,
      }
      : null,
    universeId: payload.universeId,
    universeName: payload.universeName,
  };
}

async function fetchPreviousUniverseGames(universeId: string): Promise<PreviousUniverseGames> {
  const response = await fetch(`/api/universes/${encodeURIComponent(universeId)}/games/previous`, {
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
