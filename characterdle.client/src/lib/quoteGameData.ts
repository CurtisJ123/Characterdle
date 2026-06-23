import type { CurrentUniverseGame, QuoteGameData } from '../types/universeGame';

export function buildQuoteGameData(game: CurrentUniverseGame | null): QuoteGameData | null {
  if (!game || !game.quotePrompt) {
    return null;
  }

  const answerCharacter = game.characters.find((character) => character.id === game.quotePrompt?.characterId)
    ?? game.answerCharacter;

  return {
    answerCharacter,
    attributeDefinitions: game.attributeDefinitions,
    characters: game.characters,
    gameId: game.id,
    prompt: {
      characterId: game.quotePrompt.characterId,
      episodeNumber: game.quotePrompt.episodeNumber,
      episodeTitle: game.quotePrompt.episodeTitle ?? null,
      id: String(game.quotePrompt.id),
      seasonNumber: game.quotePrompt.seasonNumber,
      text: game.quotePrompt.text,
    },
    universeId: game.universeId,
    universeName: game.universeName,
  };
}
