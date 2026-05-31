import type { CharacterAttribute } from './game';

export type UniverseAttributeKind = 'string' | 'number' | 'boolean' | 'list';

export type UniverseAttributeValue = string | number | boolean | string[];

export interface UniverseAttributeDefinition {
  key: string;
  label: string;
  kind: UniverseAttributeKind;
  emptyLabel?: string | null;
  falseLabel?: string | null;
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

export interface CharacterGameHint {
  id: string;
  label: string;
  value: string;
}

export type CharacterGameStatus = 'playing' | 'won' | 'lost';
