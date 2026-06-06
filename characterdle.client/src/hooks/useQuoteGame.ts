import { useEffect, useState } from 'react';
import {
  getQuoteGameStatsStorageKey,
  getQuoteGameStorageKey,
  hasExpiredGiveUp,
  readQuoteGameGuessCounts,
} from '../lib/characterGameProgress';
import { resolveCharacterSearch } from '../lib/characterSearch';
import { compareAttributeValue, formatAttributeValue } from '../lib/universeAttributes';
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
  completionRecorded: boolean;
  firstLetterRevealed: boolean;
  gaveUp: boolean;
  guessedCharacterIds: number[];
  revealedHintKeys: string[];
  resolvedAt?: string | null;
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

function readStoredGuessCounts(game: QuoteGameData): number[] {
  return readQuoteGameGuessCounts(game.universeId, game.gameId);
}

function buildCompletedGameStats(guessCounts: number[]): CompletedGameStats {
  if (guessCounts.length === 0) {
    return {
      averageGuesses: null,
      playCount: 0,
    };
  }

  const totalGuesses = guessCounts.reduce((sum, value) => sum + value, 0);

  return {
    averageGuesses: totalGuesses / guessCounts.length,
    playCount: guessCounts.length,
  };
}

function readStoredGameStats(game: QuoteGameData): CompletedGameStats {
  return buildCompletedGameStats(readStoredGuessCounts(game));
}

function readStoredState(game: QuoteGameData): StoredQuoteGameState {
  if (typeof window === 'undefined') {
    return {
      completionRecorded: false,
      firstLetterRevealed: false,
      gaveUp: false,
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
    const rawValue = window.localStorage.getItem(getQuoteGameStorageKey(game.universeId, game.gameId));

    if (!rawValue) {
      return {
        completionRecorded: false,
        firstLetterRevealed: false,
        gaveUp: false,
        guessedCharacterIds: [],
        revealedHintKeys: [],
      };
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredQuoteGameState>;
    const resolvedAt = typeof parsedValue.resolvedAt === 'string' && !Number.isNaN(Date.parse(parsedValue.resolvedAt))
      ? parsedValue.resolvedAt
      : null;

    if (parsedValue.gaveUp === true && hasExpiredGiveUp(resolvedAt)) {
      return {
        completionRecorded: false,
        firstLetterRevealed: false,
        gaveUp: false,
        guessedCharacterIds: [],
        revealedHintKeys: [],
      };
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
    return {
      completionRecorded: false,
      firstLetterRevealed: false,
      gaveUp: false,
      guessedCharacterIds: [],
      revealedHintKeys: [],
    };
  }
}

export function useQuoteGame(game: QuoteGameData | null): GameRoundState<QuoteGameRow> {
  const [guessedCharacterIds, setGuessedCharacterIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [completionRecorded, setCompletionRecorded] = useState(false);
  const [firstLetterRevealed, setFirstLetterRevealed] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [revealedHintKeys, setRevealedHintKeys] = useState<string[]>([]);
  const [completedGameStats, setCompletedGameStats] = useState<CompletedGameStats>({
    averageGuesses: null,
    playCount: 0,
  });

  useEffect(() => {
    if (!game) {
      setGuessedCharacterIds([]);
      setMessage(null);
      setCompletionRecorded(false);
      setFirstLetterRevealed(false);
      setGaveUp(false);
      setRevealedHintKeys([]);
      setCompletedGameStats({
        averageGuesses: null,
        playCount: 0,
      });
      return;
    }

    const storedState = readStoredState(game);
    setGuessedCharacterIds(storedState.guessedCharacterIds);
    setCompletionRecorded(storedState.completionRecorded);
    setFirstLetterRevealed(storedState.firstLetterRevealed);
    setGaveUp(storedState.gaveUp);
    setRevealedHintKeys(storedState.revealedHintKeys);
    setCompletedGameStats(readStoredGameStats(game));
    setMessage(null);
  }, [game]);

  useEffect(() => {
    if (!game || typeof window === 'undefined') {
      return;
    }

    const storedState: StoredQuoteGameState = {
      completionRecorded,
      firstLetterRevealed,
      gaveUp,
      guessedCharacterIds,
      revealedHintKeys,
      resolvedAt: completionRecorded || gaveUp
        ? (() => {
          const existingRawValue = window.localStorage.getItem(getQuoteGameStorageKey(game.universeId, game.gameId));

          if (existingRawValue) {
            try {
              const existingState = JSON.parse(existingRawValue) as Partial<StoredQuoteGameState>;

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
      getQuoteGameStorageKey(game.universeId, game.gameId),
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
  const roleDefinition = game ? getRoleDefinition(game) : null;
  const revealedHints = game
    ? [
      ...revealedHintKeys.map((key) => {
        if (key === QUOTE_SOURCE_HINT_ID) {
          return {
            id: QUOTE_SOURCE_HINT_ID,
            label: 'Season / Episode',
            value: `S${game.prompt.seasonNumber} E${game.prompt.episodeNumber}`,
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

  useEffect(() => {
    if (!game || !isSolved || completionRecorded || typeof window === 'undefined') {
      return;
    }

    if (isStatsEligible) {
      const storageKey = getQuoteGameStatsStorageKey(game.universeId, game.gameId);
      const existingGuessCounts = readStoredGuessCounts(game);
      const nextGuessCounts = [...existingGuessCounts, guessedCharacterIds.length];

      window.localStorage.setItem(storageKey, JSON.stringify({ guessCounts: nextGuessCounts }));
      setCompletedGameStats(buildCompletedGameStats(nextGuessCounts));
    } else {
      setCompletedGameStats(readStoredGameStats(game));
    }

    setCompletionRecorded(true);
  }, [completionRecorded, game, guessedCharacterIds.length, isSolved, isStatsEligible]);

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
    if (!game || status !== 'playing') {
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
    setFirstLetterRevealed(false);
    setGaveUp(false);
    setRevealedHintKeys([]);

    if (!game || typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(getQuoteGameStorageKey(game.universeId, game.gameId));
  }

  return {
    completedGameStats,
    guessCount: guessedCharacterIds.length,
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
