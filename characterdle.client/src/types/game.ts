import type { Page } from './routes';

export type AttributeTone = 'correct' | 'partial' | 'neutral';

export type DistributionTone = 'muted' | 'primary' | 'danger';

export interface NavItem {
  id: Page;
  label: string;
}

export interface Universe {
  title: string;
  genre: string;
  status: string;
  accent: string;
  description: string;
}

export interface LeaderboardRow {
  rank: number;
  player: string;
  tier: string;
  wins: string;
  guesses: string;
  mastery: string[];
}

export interface CharacterAttribute {
  label: string;
  tone: AttributeTone;
}

export interface CharacterGuess {
  name: string;
  house: CharacterAttribute;
  culture: CharacterAttribute;
  region: CharacterAttribute;
  allegiance: CharacterAttribute;
  debut: CharacterAttribute;
}

export interface GuessDistributionItem {
  guess: number;
  count: number;
  width: number;
  tone: DistributionTone;
}
