import { useEffect, useState } from 'react';
import {
  getQuoteGameStorageKey,
} from '../lib/characterGameProgress';
import { getAttemptNumber, mergeReplayProgress, prepareReplayProgress } from '../lib/gameReplay';
import { resolveCharacterSearch } from '../lib/characterSearch';
import { formatQuoteEpisodeLabel } from '../lib/quotePrompt';
import { compareAttributeValue, formatAttributeValue } from '../lib/universeAttributes';
import type { PersistedGameResult } from '../types/profile';
import type {
  CharacterGameHint,
  CharacterGameStatus,
  CompletedGameStats,
  GameRoundState,
  QuoteGameData,
  QuoteGameRow,
  SubmitGuessResult,
  UniverseAttributeDefinition,
  UniverseCharacter,
} from '../types/universeGame';

interface StoredQuoteGameState {
  attemptNumber?: number;
  completionRecorded: boolean;
  firstLetterRevealed: boolean;
  gaveUp: boolean;
  guessCount: number;
  guessedCharacterIds: number[];
  revealedHintKeys: string[];
  resolvedAt?: string | null;
  updatedAt?: string | null;
}

const QUOTE_SOURCE_HINT_ID = 'quote-source';
const QUOTE_ROLE_HINT_ID = 'quote-role';

function getRoleDefinition(game: QuoteGameData): UniverseAttributeDefinition | null {
  return game.attributeDefinitions.find((definition) => definition.key === 'occupation')
    ?? game.attributeDefinitions.find((definition) => definition.label.toLowerCase().includes('role'))
    ?? null;
}

function buildRow(character: UniverseCharacter, answer: UniverseCharacter): QuoteGameRow {
  return {
    id: character.id,
    isCorrect: character.id === answer.id,
    name: character.displayName || 'ERROR',
    portraitUrl: character.portraitUrl ?? null,
  };
}

function getCorrectAttributeKeys(
  game: QuoteGameData,
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
  labelOverride?: string,
  idOverride?: string,
): CharacterGameHint {
  return {
    id: idOverride ?? definition.key,
    label: labelOverride ?? definition.label,
    value: formatAttributeValue(definition, answer.attributes[definition.key]),
  };
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

function hasStoredActivity(state: StoredQuoteGameState): boolean {
  return state.completionRecorded
    || state.gaveUp
    || state.firstLetterRevealed
    || state.guessedCharacterIds.length > 0
    || state.revealedHintKeys.length > 0;
}

function readStoredState(game: QuoteGameData, ownerKey: string): StoredQuoteGameState {
  if (typeof window === 'undefined') {
    return {
      completionRecorded: false,
      firstLetterRevealed: false,
      gaveUp: false,
      guessCount: 0,
      guessedCharacterIds: [],
      revealedHintKeys: [],
    };
  }

  const allowedCharacterIds = new Set(game.characters.map((character) => character.id));
  const allowedHintKeys = new Set<string>([
    QUOTE_SOURCE_HINT_ID,
    QUOTE_ROLE_HINT_ID,
    ...game.attributeDefinitions.map((definition) => definition.key),
  ]);

  try {
    const rawValue = window.localStorage.getItem(
      getQuoteGameStorageKey(ownerKey, game.universeId, game.gameId),
    );

    if (!rawValue) {
      return {
        completionRecorded: false,
        firstLetterRevealed: false,
        gaveUp: false,
        guessCount: 0,
        guessedCharacterIds: [],
        revealedHintKeys: [],
      };
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredQuoteGameState>;
    const resolvedAt = typeof parsedValue.resolvedAt === 'string' && !Number.isNaN(Date.parse(parsedValue.resolvedAt))
      ? parsedValue.resolvedAt
      : null;

    return prepareReplayProgress({
      attemptNumber: getAttemptNumber(parsedValue.attemptNumber),
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
    });
  } catch {
    return {
      completionRecorded: false,
      firstLetterRevealed: false,
      gaveUp: false,
      guessCount: 0,
      guessedCharacterIds: [],
      revealedHintKeys: [],
    };
  }
}

function resolveStoredState(
  game: QuoteGameData,
  persistedResult: PersistedGameResult | null,
  ownerKey: string,
): StoredQuoteGameState {
  const localState = readStoredState(game, ownerKey);

  if (!persistedResult || persistedResult.mode !== 'quote') {
    return localState;
  }

  const allowedCharacterIds = new Set(game.characters.map((character) => character.id));
  const allowedHintKeys = new Set<string>([
    QUOTE_SOURCE_HINT_ID,
    QUOTE_ROLE_HINT_ID,
  ]);
  const remoteGuessedCharacterIds = persistedResult.guessedCharacterIds.filter(
    (characterId) => allowedCharacterIds.has(characterId),
  );
  const remoteState: StoredQuoteGameState = {
    attemptNumber: getAttemptNumber(persistedResult.attemptNumber),
    completionRecorded: persistedResult.status === 'won',
    firstLetterRevealed: persistedResult.revealedHintKeys.includes('first-letter'),
    gaveUp: persistedResult.status === 'lost',
    guessCount: Math.max(persistedResult.guessCount, remoteGuessedCharacterIds.length),
    guessedCharacterIds: remoteGuessedCharacterIds,
    revealedHintKeys: persistedResult.revealedHintKeys.filter((key) => allowedHintKeys.has(key)),
    resolvedAt: persistedResult.completedAt,
    updatedAt: persistedResult.updatedAt,
  };
  return mergeReplayProgress(localState, prepareReplayProgress({ ...remoteState, hintCount: persistedResult.hintCount }));
}

export function useQuoteGame(
  game: QuoteGameData | null,
  persistedResult: PersistedGameResult | null = null,
  ownerKey = 'guest',
  persistProgress = true,
): GameRoundState<QuoteGameRow> {
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [loadedInputs, setLoadedInputs] = useState<{
    game: QuoteGameData | null;
    ownerKey: string;
    persistedResult: PersistedGameResult | null;
    persistProgress: boolean;
  } | null>(null);
  const isReady = loadedInputs?.game === game && loadedInputs.ownerKey === ownerKey
    && loadedInputs.persistedResult === persistedResult && loadedInputs.persistProgress === persistProgress;
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
    setLoadedInputs({ game, ownerKey, persistedResult, persistProgress });
    if (!game) {
      setAttemptNumber(0);
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

    const storedState: StoredQuoteGameState = persistProgress
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
    setAttemptNumber(getAttemptNumber(storedState.attemptNumber));
    setTotalGuessCount(storedState.guessCount);
    setGuessedCharacterIds(storedState.guessedCharacterIds);
    setCompletionRecorded(storedState.completionRecorded);
    setHasRecordedPlay(storedActivity);
    setIsAggregateUpdateEligible(!storedActivity);
    setFirstLetterRevealed(storedState.firstLetterRevealed);
    setGaveUp(storedState.gaveUp);
    setRevealedHintKeys(storedState.revealedHintKeys);
    setCompletedGameStats(cloneCompletedGameStats(game.completedGameStats));
    setMessage(null);
  }, [game, ownerKey, persistProgress, persistedResult]);

  useEffect(() => {
    if (!isReady || !persistProgress || !game || typeof window === 'undefined') {
      return;
    }

    const storedState: StoredQuoteGameState = {
      attemptNumber,
      completionRecorded,
      firstLetterRevealed,
      gaveUp,
      guessCount: totalGuessCount,
      guessedCharacterIds,
      revealedHintKeys,
      resolvedAt: completionRecorded || gaveUp
        ? (() => {
          const existingRawValue = window.localStorage.getItem(
            getQuoteGameStorageKey(ownerKey, game.universeId, game.gameId),
          );

          if (existingRawValue) {
            try {
              const existingState = JSON.parse(existingRawValue) as Partial<StoredQuoteGameState>;

              if (getAttemptNumber(existingState.attemptNumber) === attemptNumber
                && typeof existingState.resolvedAt === 'string' && !Number.isNaN(Date.parse(existingState.resolvedAt))) {
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
      getQuoteGameStorageKey(ownerKey, game.universeId, game.gameId),
      JSON.stringify(storedState),
    );
  }, [
    attemptNumber,
    isReady,
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
  const roleDefinition = game ? getRoleDefinition(game) : null;
  const revealedHints = game
    ? [
      ...revealedHintKeys.map((key) => {
        if (key === QUOTE_SOURCE_HINT_ID) {
          return {
            id: QUOTE_SOURCE_HINT_ID,
            label: 'Season / Episode',
            value: formatQuoteEpisodeLabel(game.prompt),
          };
        }

        if (key === QUOTE_ROLE_HINT_ID && roleDefinition) {
          return buildHint(roleDefinition, game.answerCharacter, 'Role', QUOTE_ROLE_HINT_ID);
        }

        const definition = game.attributeDefinitions.find((item) => item.key === key) ?? null;
        return definition ? buildHint(definition, game.answerCharacter) : null;
      }).filter((hint): hint is CharacterGameHint => hint !== null),
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
    if (!isReady || !game || hasRecordedPlay || !hasMeaningfulActivity) {
      return;
    }

    setCompletedGameStats((currentStats) => incrementPlayCount(currentStats));
    setHasRecordedPlay(true);
  }, [game, hasMeaningfulActivity, hasRecordedPlay, isReady]);

  useEffect(() => {
    if (!isReady || !game || !isSolved || completionRecorded || typeof window === 'undefined') {
      return;
    }

    if (isStatsEligible && isAggregateUpdateEligible) {
      setCompletedGameStats((currentStats) => recordQualifiedWin(currentStats, totalGuessCount));
    }

    setIsAggregateUpdateEligible(false);
    setCompletionRecorded(true);
  }, [completionRecorded, game, isAggregateUpdateEligible, isSolved, isStatsEligible, totalGuessCount, isReady]);

  function submitGuess(query: string): SubmitGuessResult {
    if (!isReady || !game) {
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
    if (!isReady || !game || status !== 'playing') {
      return;
    }

    if (firstLetterRevealed) {
      setGaveUp(true);
      return;
    }

    if (
      !revealedHintKeys.includes(QUOTE_SOURCE_HINT_ID)
    ) {
      setRevealedHintKeys((currentKeys) => [...currentKeys, QUOTE_SOURCE_HINT_ID]);
      return;
    }

    if (
      roleDefinition
      && !revealedHintKeys.includes(QUOTE_ROLE_HINT_ID)
      && !correctAttributeKeys.has(roleDefinition.key)
    ) {
      setRevealedHintKeys((currentKeys) => [...currentKeys, QUOTE_ROLE_HINT_ID]);
      return;
    }

    if (!firstLetterRevealed) {
      setFirstLetterRevealed(true);
    }
  }

  function resetGame() {
    setGuessedCharacterIds([]);
    setMessage(null);
    setCompletionRecorded(false);
    setHasRecordedPlay(false);
    setIsAggregateUpdateEligible(true);
    setFirstLetterRevealed(false);
    setGaveUp(false);
    setTotalGuessCount(0);
    setRevealedHintKeys([]);
    setCompletedGameStats(cloneCompletedGameStats(game?.completedGameStats));

    if (!persistProgress || !game || typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(getQuoteGameStorageKey(ownerKey, game.universeId, game.gameId));
  }

  return {
    attemptNumber,
    isReady,
    completedGameStats,
    guessCount: totalGuessCount,
    guessedCharacterIds,
    handleHintAction,
    hintActionLabel,
    hintCount,
    isSolved,
    message,
    revealedHints,
    resetGame,
    rows: game ? guessedCharacters.map((character) => buildRow(character, game.answerCharacter)) : [],
    status,
    submitGuess,
  };
}
