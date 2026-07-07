import { useEffect, useState } from 'react';
import {
  getCharacterGameStorageKey,
  getLegacyCharacterGameSessionStorageKey,
  hasExpiredGiveUp,
} from '../lib/characterGameProgress';
import { resolveCharacterSearch } from '../lib/characterSearch';
import { compareAttributeValue, formatAttributeValue } from '../lib/universeAttributes';
import type { PersistedGameResult } from '../types/profile';
import type {
  CharacterGameHint,
  CharacterGameRow,
  CharacterGameStatus,
  CompletedGameStats,
  CurrentUniverseGame,
  GameRoundState,
  SubmitGuessResult,
  UniverseAttributeDefinition,
  UniverseCharacter,
} from '../types/universeGame';

interface StoredCharacterGameState {
  completionRecorded: boolean;
  firstLetterRevealed: boolean;
  gaveUp: boolean;
  guessCount: number;
  guessedCharacterIds: number[];
  revealedHintKeys: string[];
  resolvedAt?: string | null;
  updatedAt?: string | null;
}

const hintPriorityOrder = [
  'gender',
  'species',
  'alive',
  'occupation',
  'debutSeason',
  'lastSeason',
  'house',
] as const;

const hintPriorityLookup = new Map<string, number>(
  hintPriorityOrder.map((key, index) => [key, index]),
);

function buildRow(character: UniverseCharacter, answer: UniverseCharacter, game: CurrentUniverseGame): CharacterGameRow {
  return {
    name: character.displayName || 'ERROR',
    portraitUrl: character.portraitUrl ?? null,
    cells: game.attributeDefinitions.map((definition, index) => {
      const attribute = compareAttributeValue(
        definition,
        character.attributes[definition.key],
        answer.attributes[definition.key],
      );

      return {
        ...attribute,
        revealOrder: index,
      };
    }),
  };
}

function buildRows(
  game: CurrentUniverseGame,
  guessedCharacters: UniverseCharacter[],
  lastSubmittedCharacterId: number | null,
): CharacterGameRow[] {
  const rowsFromOldestToNewest: CharacterGameRow[] = [];
  const discoveredCorrectKeys = new Set<string>();

  for (const character of [...guessedCharacters].reverse()) {
    const baseRow = buildRow(character, game.answerCharacter, game);
    const isNewestSubmittedRow = character.id === lastSubmittedCharacterId;

    rowsFromOldestToNewest.push({
      ...baseRow,
      cells: baseRow.cells.map((cell, index) => {
        const definition = game.attributeDefinitions[index];

        if (!definition || cell.tone !== 'correct') {
          return cell;
        }

        const isNewlyDiscovered = !discoveredCorrectKeys.has(definition.key);
        discoveredCorrectKeys.add(definition.key);

        if (!isNewestSubmittedRow || !isNewlyDiscovered) {
          return {
            ...cell,
            isRevealing: isNewestSubmittedRow,
          };
        }

        return {
          ...cell,
          isNewlyDiscovered: true,
          isRevealing: true,
        };
      }),
    });
  }

  return rowsFromOldestToNewest.reverse();
}

function getCorrectAttributeKeys(
  game: CurrentUniverseGame,
  guessedCharacters: UniverseCharacter[],
): Set<string> {
  const correctKeys = new Set<string>();

  for (const definition of game.attributeDefinitions) {
    const hasCorrectMatch = guessedCharacters.some((character) => compareAttributeValue(
      definition,
      character.attributes[definition.key],
      game.answerCharacter.attributes[definition.key],
    ).tone === 'correct');

    if (hasCorrectMatch) {
      correctKeys.add(definition.key);
    }
  }

  return correctKeys;
}

function buildHint(
  definition: UniverseAttributeDefinition,
  answer: UniverseCharacter,
): CharacterGameHint {
  return {
    id: definition.key,
    label: definition.label,
    value: formatAttributeValue(definition, answer.attributes[definition.key]),
  };
}

function sortHintDefinitions(definitions: readonly UniverseAttributeDefinition[]): UniverseAttributeDefinition[] {
  return [...definitions].sort((left, right) => {
    const leftPriority = hintPriorityLookup.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = hintPriorityLookup.get(right.key) ?? Number.MAX_SAFE_INTEGER;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.label.localeCompare(right.label);
  });
}

function getSessionStorageKey(ownerKey: string, universeId: string, gameId: number): string {
  return getCharacterGameStorageKey(ownerKey, universeId, gameId);
}

function getLegacySessionStorageKey(ownerKey: string, universeId: string, gameId: number): string {
  return getLegacyCharacterGameSessionStorageKey(ownerKey, universeId, gameId);
}

function createEmptyCompletedGameStats(): CompletedGameStats {
  return {
    averageGuessSampleSize: 0,
    averageGuesses: null,
    playCount: 0,
  };
}

function cloneCompletedGameStats(stats: CompletedGameStats | null | undefined): CompletedGameStats {
  return stats
    ? {
      averageGuessSampleSize: stats.averageGuessSampleSize,
      averageGuesses: stats.averageGuesses,
      playCount: stats.playCount,
    }
    : createEmptyCompletedGameStats();
}

function incrementPlayCount(stats: CompletedGameStats): CompletedGameStats {
  return {
    ...stats,
    playCount: stats.playCount + 1,
  };
}

function recordQualifiedWin(stats: CompletedGameStats, guessCount: number): CompletedGameStats {
  const nextSampleSize = stats.averageGuessSampleSize + 1;
  const currentTotalGuesses = (stats.averageGuesses ?? 0) * stats.averageGuessSampleSize;

  return {
    averageGuessSampleSize: nextSampleSize,
    averageGuesses: (currentTotalGuesses + guessCount) / nextSampleSize,
    playCount: stats.playCount,
  };
}

function hasStoredActivity(state: StoredCharacterGameState): boolean {
  return state.completionRecorded
    || state.gaveUp
    || state.firstLetterRevealed
    || state.guessedCharacterIds.length > 0
    || state.revealedHintKeys.length > 0;
}

function readStoredState(game: CurrentUniverseGame, ownerKey: string): StoredCharacterGameState {
  const defaultState: StoredCharacterGameState = {
    completionRecorded: false,
    firstLetterRevealed: false,
    gaveUp: false,
    guessCount: 0,
    guessedCharacterIds: [],
    revealedHintKeys: [],
  };

  if (typeof window === 'undefined') {
    return defaultState;
  }

  const allowedCharacterIds = new Set(game.characters.map((character) => character.id));
  const allowedHintKeys = new Set(game.attributeDefinitions.map((definition) => definition.key));

  function parseStoredState(rawValue: string | null): StoredCharacterGameState | null {
    if (!rawValue) {
      return null;
    }

    try {
      const parsedValue = JSON.parse(rawValue) as Partial<StoredCharacterGameState>;
      const resolvedAt = typeof parsedValue.resolvedAt === 'string' && !Number.isNaN(Date.parse(parsedValue.resolvedAt))
        ? parsedValue.resolvedAt
        : null;

      if (parsedValue.gaveUp === true && hasExpiredGiveUp(resolvedAt)) {
        return null;
      }

      return {
        completionRecorded: parsedValue.completionRecorded === true,
        firstLetterRevealed: parsedValue.firstLetterRevealed === true,
        gaveUp: parsedValue.gaveUp === true,
        guessCount: typeof parsedValue.guessCount === 'number' && parsedValue.guessCount >= 0
          ? Math.max(parsedValue.guessCount, parsedValue.guessedCharacterIds?.length ?? 0)
          : parsedValue.guessedCharacterIds?.length ?? 0,
        guessedCharacterIds: Array.isArray(parsedValue.guessedCharacterIds)
          ? parsedValue.guessedCharacterIds
            .filter((characterId) => typeof characterId === 'number' && allowedCharacterIds.has(characterId))
          : [],
        revealedHintKeys: Array.isArray(parsedValue.revealedHintKeys)
          ? parsedValue.revealedHintKeys
            .filter((key) => typeof key === 'string' && allowedHintKeys.has(key))
          : [],
        resolvedAt,
        updatedAt: typeof parsedValue.updatedAt === 'string' && !Number.isNaN(Date.parse(parsedValue.updatedAt))
          ? parsedValue.updatedAt
          : null,
      };
    } catch {
      return null;
    }
  }

  const localStorageValue = parseStoredState(
    window.localStorage.getItem(getSessionStorageKey(ownerKey, game.universeId, game.id)),
  );

  if (localStorageValue) {
    return localStorageValue;
  }

  const legacySessionValue = parseStoredState(
    window.sessionStorage.getItem(getLegacySessionStorageKey(ownerKey, game.universeId, game.id)),
  );

  if (legacySessionValue) {
    try {
      window.localStorage.setItem(
        getSessionStorageKey(ownerKey, game.universeId, game.id),
        JSON.stringify(legacySessionValue),
      );
    } catch {
      // Ignore local storage failures and still return the recovered state.
    }

    return legacySessionValue;
  }

  return defaultState;
}

function resolveStoredState(
  game: CurrentUniverseGame,
  persistedResult: PersistedGameResult | null,
  ownerKey: string,
): StoredCharacterGameState {
  const localState = readStoredState(game, ownerKey);

  if (!persistedResult || persistedResult.mode !== 'character') {
    return localState;
  }

  if (persistedResult.status === 'lost' && hasExpiredGiveUp(persistedResult.completedAt)) {
    return localState;
  }

  const allowedCharacterIds = new Set(game.characters.map((character) => character.id));
  const allowedHintKeys = new Set(game.attributeDefinitions.map((definition) => definition.key));
  const remoteGuessedCharacterIds = persistedResult.guessedCharacterIds.filter(
    (characterId) => allowedCharacterIds.has(characterId),
  );
  const remoteFirstLetterRevealed = persistedResult.revealedHintKeys.includes('first-letter');
  const remoteState: StoredCharacterGameState = {
    completionRecorded: persistedResult.status === 'won',
    firstLetterRevealed: remoteFirstLetterRevealed,
    gaveUp: persistedResult.status === 'lost',
    guessCount: Math.max(persistedResult.guessCount, remoteGuessedCharacterIds.length),
    guessedCharacterIds: remoteGuessedCharacterIds,
    revealedHintKeys: persistedResult.revealedHintKeys.filter((key) => allowedHintKeys.has(key)),
    resolvedAt: persistedResult.completedAt,
    updatedAt: persistedResult.updatedAt,
  };
  const localIsComplete = localState.completionRecorded || localState.gaveUp;
  const remoteIsComplete = remoteState.completionRecorded || remoteState.gaveUp;

  if (localIsComplete !== remoteIsComplete) {
    return remoteIsComplete ? remoteState : localState;
  }

  const localProgress = localState.guessCount
    + localState.revealedHintKeys.length
    + (localState.firstLetterRevealed ? 1 : 0);
  const remoteProgress = remoteState.guessCount
    + remoteState.revealedHintKeys.length
    + (remoteState.firstLetterRevealed ? 1 : 0);

  if (remoteProgress !== localProgress) {
    return remoteProgress > localProgress ? remoteState : localState;
  }

  if (localState.updatedAt && Date.parse(remoteState.updatedAt ?? '') > Date.parse(localState.updatedAt)) {
    return remoteState;
  }

  return localState;
}

export function useCharacterGame(
  game: CurrentUniverseGame | null,
  persistedResult: PersistedGameResult | null = null,
  ownerKey = 'guest',
  persistProgress = true,
): GameRoundState<CharacterGameRow> {
  const [lastSubmittedCharacterId, setLastSubmittedCharacterId] = useState<number | null>(null);
  const [totalGuessCount, setTotalGuessCount] = useState(0);
  const [guessedCharacterIds, setGuessedCharacterIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [completionRecorded, setCompletionRecorded] = useState(false);
  const [hasRecordedPlay, setHasRecordedPlay] = useState(false);
  const [isAggregateUpdateEligible, setIsAggregateUpdateEligible] = useState(false);
  const [firstLetterRevealed, setFirstLetterRevealed] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [revealedHintKeys, setRevealedHintKeys] = useState<string[]>([]);
  const [completedGameStats, setCompletedGameStats] = useState<CompletedGameStats>(createEmptyCompletedGameStats());

  useEffect(() => {
    if (!game) {
      setLastSubmittedCharacterId(null);
      setGuessedCharacterIds([]);
      setMessage(null);
      setCompletionRecorded(false);
      setHasRecordedPlay(false);
      setIsAggregateUpdateEligible(false);
      setFirstLetterRevealed(false);
      setGaveUp(false);
      setTotalGuessCount(0);
      setRevealedHintKeys([]);
      setCompletedGameStats(createEmptyCompletedGameStats());
      return;
    }

    const storedState = persistProgress
      ? resolveStoredState(game, persistedResult, ownerKey)
      : {
        completionRecorded: false,
        firstLetterRevealed: false,
        gaveUp: false,
        guessCount: 0,
        guessedCharacterIds: [],
        revealedHintKeys: [],
      };
    const storedActivity = hasStoredActivity(storedState);
    setLastSubmittedCharacterId(null);
    setTotalGuessCount(storedState.guessCount);
    setGuessedCharacterIds(storedState.guessedCharacterIds);
    setCompletionRecorded(storedState.completionRecorded);
    setHasRecordedPlay(storedActivity);
    setIsAggregateUpdateEligible(!storedActivity);
    setFirstLetterRevealed(storedState.firstLetterRevealed);
    setGaveUp(storedState.gaveUp);
    setRevealedHintKeys(storedState.revealedHintKeys);
    setCompletedGameStats(cloneCompletedGameStats(game.characterStats));
    setMessage(null);
  }, [game, ownerKey, persistProgress, persistedResult]);

  useEffect(() => {
    if (!persistProgress || !game || typeof window === 'undefined') {
      return;
    }

    const storedState: StoredCharacterGameState = {
      completionRecorded,
      firstLetterRevealed,
      gaveUp,
      guessCount: totalGuessCount,
      guessedCharacterIds,
      revealedHintKeys,
      resolvedAt: completionRecorded || gaveUp
        ? (() => {
          const existingRawValue = window.localStorage.getItem(
            getSessionStorageKey(ownerKey, game.universeId, game.id),
          );

          if (existingRawValue) {
            try {
              const existingState = JSON.parse(existingRawValue) as Partial<StoredCharacterGameState>;

              if (typeof existingState.resolvedAt === 'string' && !Number.isNaN(Date.parse(existingState.resolvedAt))) {
                return existingState.resolvedAt;
              }
            } catch {
              // Ignore malformed existing state and write a fresh timestamp.
            }
          }

          return new Date().toISOString();
        })()
        : null,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(
      getSessionStorageKey(ownerKey, game.universeId, game.id),
      JSON.stringify(storedState),
    );
  }, [
    completionRecorded,
    firstLetterRevealed,
    game,
    gaveUp,
    guessedCharacterIds,
    ownerKey,
    persistProgress,
    revealedHintKeys,
    totalGuessCount,
  ]);

  const guessedCharacters = game
    ? guessedCharacterIds
      .map((characterId) => game.characters.find((character) => character.id === characterId) ?? null)
      .filter((character): character is UniverseCharacter => character !== null)
    : [];

  const correctAttributeKeys = game
    ? getCorrectAttributeKeys(game, guessedCharacters)
    : new Set<string>();
  const unrevealedHintDefinitions = game
    ? sortHintDefinitions(game.attributeDefinitions).filter((definition) => (
      !correctAttributeKeys.has(definition.key) && !revealedHintKeys.includes(definition.key)
    ))
    : [];
  const revealedHints = game
    ? [
      ...revealedHintKeys
        .map((key) => game.attributeDefinitions.find((definition) => definition.key === key) ?? null)
        .filter((definition): definition is UniverseAttributeDefinition => definition !== null)
        .map((definition) => buildHint(definition, game.answerCharacter)),
      ...(firstLetterRevealed
        ? [{
          id: 'first-letter',
          label: 'First letter',
          value: game.answerCharacter.displayName.charAt(0).toUpperCase() || 'ERROR',
        }]
        : []),
    ]
    : [];
  const hintCount = revealedHintKeys.length + (firstLetterRevealed ? 1 : 0);
  const isSolved = !!game && guessedCharacterIds.includes(game.answerCharacter.id);
  const status: CharacterGameStatus = isSolved ? 'won' : gaveUp ? 'lost' : 'playing';
  const hintActionLabel = firstLetterRevealed ? 'Give Up' : 'Hint';
  const isStatsEligible = hintCount === 0;
  const hasMeaningfulActivity = totalGuessCount > 0 || hintCount > 0 || status !== 'playing';

  useEffect(() => {
    if (!game || hasRecordedPlay || !hasMeaningfulActivity) {
      return;
    }

    setCompletedGameStats((currentStats) => incrementPlayCount(currentStats));
    setHasRecordedPlay(true);
  }, [game, hasMeaningfulActivity, hasRecordedPlay]);

  useEffect(() => {
    if (!game || !isSolved || completionRecorded || typeof window === 'undefined') {
      return;
    }

    if (isStatsEligible && isAggregateUpdateEligible) {
      setCompletedGameStats((currentStats) => recordQualifiedWin(currentStats, totalGuessCount));
    }

    setIsAggregateUpdateEligible(false);
    setCompletionRecorded(true);
  }, [completionRecorded, game, isAggregateUpdateEligible, isSolved, isStatsEligible, totalGuessCount]);

  function submitGuess(query: string): SubmitGuessResult {
    if (!game) {
      return {
        accepted: false,
        wasCorrect: false,
      };
    }

    if (status !== 'playing') {
      setMessage(status === 'won'
        ? 'Already solved.'
        : 'Game over.');

      return {
        accepted: false,
        wasCorrect: false,
      };
    }

    const match = resolveCharacterSearch(query, game.characters);

    if (!match.character) {
      setMessage(match.reason === 'ambiguous'
        ? 'More than one match.'
        : 'No match.');

      return {
        accepted: false,
        wasCorrect: false,
      };
    }

    if (guessedCharacterIds.includes(match.character.id)) {
      setMessage(`Already guessed ${match.character.displayName}.`);

      return {
        accepted: false,
        wasCorrect: false,
      };
    }

    const nextGuessedCharacterIds = [match.character.id, ...guessedCharacterIds];
    const wasCorrect = match.character.id === game.answerCharacter.id;

    setLastSubmittedCharacterId(match.character.id);
    setGuessedCharacterIds(nextGuessedCharacterIds);
    setTotalGuessCount((currentCount) => currentCount + 1);
    setMessage(
      wasCorrect
        ? 'Correct.'
        : `${match.character.displayName} added.`,
    );

    return {
      accepted: true,
      wasCorrect,
    };
  }

  function handleHintAction() {
    if (!game) {
      return;
    }

    if (status === 'won') {
      return;
    }

    if (status === 'lost') {
      return;
    }

    if (firstLetterRevealed) {
      setGaveUp(true);
      return;
    }

    if (revealedHintKeys.length >= 2 || unrevealedHintDefinitions.length === 0) {
      setFirstLetterRevealed(true);
      return;
    }

    const nextDefinition = unrevealedHintDefinitions[0];
    setRevealedHintKeys((currentKeys) => [...currentKeys, nextDefinition.key]);
  }

  function resetGame() {
    setLastSubmittedCharacterId(null);
    setGuessedCharacterIds([]);
    setMessage(null);
    setCompletionRecorded(false);
    setHasRecordedPlay(false);
    setIsAggregateUpdateEligible(true);
    setFirstLetterRevealed(false);
    setGaveUp(false);
    setTotalGuessCount(0);
    setRevealedHintKeys([]);
    setCompletedGameStats(cloneCompletedGameStats(game?.characterStats));

    if (!persistProgress || !game || typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(getSessionStorageKey(ownerKey, game.universeId, game.id));
    window.sessionStorage.removeItem(getLegacySessionStorageKey(ownerKey, game.universeId, game.id));
  }

  return {
    handleHintAction,
    hintActionLabel,
    hintCount,
    completedGameStats,
    guessCount: totalGuessCount,
    guessedCharacterIds,
    isSolved,
    message,
    revealedHints,
    resetGame,
    rows: game ? buildRows(game, guessedCharacters, lastSubmittedCharacterId) : [],
    status,
    submitGuess,
  };
}
