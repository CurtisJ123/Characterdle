import type { CharacterAttribute, GameMode } from './game';

export type UniverseAttributeKind = 'string' | 'number' | 'boolean' | 'list';

export type UniverseAttributeValue = string | number | boolean | string[];

export interface UniverseAttributeDefinition {
  key: string;
  label: string;
  kind: UniverseAttributeKind;
  emptyLabel?: string | null;
  falseLabel?: string | null;
  helpText?: string | null;
  trueLabel?: string | null;
}

export interface UniverseCharacter {
  id: number;
  displayName: string;
  aliases: string[];
  attributes: Record<string, UniverseAttributeValue>;
  portraitUrl?: string | null;
}

export interface CurrentUniverseGame {
  id: number;
  dateTime: string;
  universeId: string;
  universeName: string;
  attributeDefinitions: UniverseAttributeDefinition[];
  answerCharacter: UniverseCharacter;
  quotePrompt: QuotePrompt | null;
  characters: UniverseCharacter[];
}

export interface PreviousUniverseGame {
  id: number;
  dateTime: string;
}

export interface PreviousUniverseGames {
  universeId: string;
  universeName: string;
  attributeDefinitions: UniverseAttributeDefinition[];
  games: PreviousUniverseGame[];
}

export interface CurrentUniverseGameState {
  data: CurrentUniverseGame | null;
  error: Error | null;
  isLoading: boolean;
}

export interface PreviousUniverseGamesState {
  data: PreviousUniverseGames | null;
  error: Error | null;
  isLoading: boolean;
}

export interface CharacterGameRow {
  name: string;
  portraitUrl?: string | null;
  cells: CharacterAttribute[];
}

export interface QuoteGameRow {
  id: number;
  isCorrect: boolean;
  name: string;
  portraitUrl?: string | null;
}

export interface CharacterGameHint {
  id: string;
  label: string;
  value: string;
}

export type CharacterGameStatus = 'playing' | 'won' | 'lost';

export interface QuotePrompt {
  characterId: number;
  episodeNumber: number;
  episodeTitle?: string | null;
  id: string;
  seasonNumber: number;
  text: string;
}

export interface QuoteGameData {
  answerCharacter: UniverseCharacter;
  attributeDefinitions: UniverseAttributeDefinition[];
  characters: UniverseCharacter[];
  gameId: number;
  prompt: QuotePrompt;
  universeId: string;
  universeName: string;
}

export interface CompletedGameStats {
  averageGuesses: number | null;
  playCount: number;
}

export interface GameRoundState<RowType> {
  completedGameStats: CompletedGameStats;
  guessCount: number;
  guessedCharacterIds: number[];
  handleHintAction: () => void;
  hintActionLabel: string;
  hintCount: number;
  isSolved: boolean;
  message: string | null;
  revealedHints: CharacterGameHint[];
  resetGame: () => void;
  rows: RowType[];
  status: CharacterGameStatus;
  submitGuess: (query: string) => SubmitGuessResult;
}

export interface SubmitGuessResult {
  accepted: boolean;
  wasCorrect: boolean;
}

export interface ActiveGameStage {
  mode: GameMode;
  title: string;
}
