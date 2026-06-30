import { useEffect, useState } from 'react';
import {
  getCharacterGameStorageKey,
  getLegacyCharacterGameSessionStorageKey,
  hasExpiredGiveUp,
} from '../lib/characterGameProgress';
import { resolveCharacterSearch } from '../lib/characterSearch';
import { compareAttributeValue, formatAttributeValue } from '../lib/universeAttributes';
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
  guessedCharacterIds: number[];
  revealedHintKeys: string[];
  resolvedAt?: string | null;
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
    cells: game.attributeDefinitions.map((definition) => compareAttributeValue(
      definition,
      character.attributes[definition.key],
      answer.attributes[definition.key],
    )),
  };
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

function getSessionStorageKey(universeId: string, gameId: number): string {
  return getCharacterGameStorageKey(universeId, gameId);
}

function getLegacySessionStorageKey(universeId: string, gameId: number): string {
  return getLegacyCharacterGameSessionStorageKey(universeId, gameId);
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

function readStoredState(game: CurrentUniverseGame): StoredCharacterGameState {
  const defaultState: StoredCharacterGameState = {
    completionRecorded: false,
    firstLetterRevealed: false,
    gaveUp: false,
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
        guessedCharacterIds: Array.isArray(parsedValue.guessedCharacterIds)
          ? parsedValue.guessedCharacterIds
            .filter((characterId) => typeof characterId === 'number' && allowedCharacterIds.has(characterId))
          : [],
        revealedHintKeys: Array.isArray(parsedValue.revealedHintKeys)
          ? parsedValue.revealedHintKeys
            .filter((key) => typeof key === 'string' && allowedHintKeys.has(key))
          : [],
        resolvedAt,
      };
    } catch {
      return null;
    }
  }

  const localStorageValue = parseStoredState(
    window.localStorage.getItem(getSessionStorageKey(game.universeId, game.id)),
  );

  if (localStorageValue) {
    return localStorageValue;
  }

  const legacySessionValue = parseStoredState(
    window.sessionStorage.getItem(getLegacySessionStorageKey(game.universeId, game.id)),
  );

  if (legacySessionValue) {
    try {
      window.localStorage.setItem(
        getSessionStorageKey(game.universeId, game.id),
        JSON.stringify(legacySessionValue),
      );
    } catch {
      // Ignore local storage failures and still return the recovered state.
    }

    return legacySessionValue;
  }

  return defaultState;
}

export function useCharacterGame(game: CurrentUniverseGame | null): GameRoundState<CharacterGameRow> {
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
      setGuessedCharacterIds([]);
      setMessage(null);
      setCompletionRecorded(false);
      setHasRecordedPlay(false);
      setIsAggregateUpdateEligible(false);
      setFirstLetterRevealed(false);
      setGaveUp(false);
      setRevealedHintKeys([]);
      setCompletedGameStats(createEmptyCompletedGameStats());
      return;
    }

    const storedState = readStoredState(game);
    const storedActivity = hasStoredActivity(storedState);
    setGuessedCharacterIds(storedState.guessedCharacterIds);
    setCompletionRecorded(storedState.completionRecorded);
    setHasRecordedPlay(storedActivity);
    setIsAggregateUpdateEligible(!storedActivity);
    setFirstLetterRevealed(storedState.firstLetterRevealed);
    setGaveUp(storedState.gaveUp);
    setRevealedHintKeys(storedState.revealedHintKeys);
    setCompletedGameStats(cloneCompletedGameStats(game.characterStats));
    setMessage(null);
  }, [game]);

  useEffect(() => {
    if (!game || typeof window === 'undefined') {
      return;
    }

    const storedState: StoredCharacterGameState = {
      completionRecorded,
      firstLetterRevealed,
      gaveUp,
      guessedCharacterIds,
      revealedHintKeys,
      resolvedAt: completionRecorded || gaveUp
        ? (() => {
          const existingRawValue = window.localStorage.getItem(getSessionStorageKey(game.universeId, game.id));

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
    };

    window.localStorage.setItem(
      getSessionStorageKey(game.universeId, game.id),
      JSON.stringify(storedState),
    );
  }, [completionRecorded, firstLetterRevealed, game, gaveUp, guessedCharacterIds, revealedHintKeys]);

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
  const hasMeaningfulActivity = guessedCharacterIds.length > 0 || hintCount > 0 || status !== 'playing';

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
      setCompletedGameStats((currentStats) => recordQualifiedWin(currentStats, guessedCharacterIds.length));
    }

    setIsAggregateUpdateEligible(false);
    setCompletionRecorded(true);
  }, [completionRecorded, game, guessedCharacterIds.length, isAggregateUpdateEligible, isSolved, isStatsEligible]);

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

    setGuessedCharacterIds(nextGuessedCharacterIds);
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
    setGuessedCharacterIds([]);
    setMessage(null);
    setCompletionRecorded(false);
    setHasRecordedPlay(false);
    setIsAggregateUpdateEligible(true);
    setFirstLetterRevealed(false);
    setGaveUp(false);
    setRevealedHintKeys([]);
    setCompletedGameStats(cloneCompletedGameStats(game?.characterStats));

    if (!game || typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(getSessionStorageKey(game.universeId, game.id));
    window.sessionStorage.removeItem(getLegacySessionStorageKey(game.universeId, game.id));
  }

  return {
    handleHintAction,
    hintActionLabel,
    hintCount,
    completedGameStats,
    guessCount: guessedCharacterIds.length,
    guessedCharacterIds,
    isSolved,
    message,
    revealedHints,
    resetGame,
    rows: game ? guessedCharacters.map((character) => buildRow(character, game.answerCharacter, game)) : [],
    status,
    submitGuess,
  };
}
