import type { Page } from './routes';

export type AttributeTone = 'correct' | 'partial' | 'neutral';

export type DistributionTone = 'muted' | 'primary' | 'danger';

export interface NavItem {
  id: Page;
  label: string;
}

export interface Universe {
  id: string;
  title: string;
  genre: string;
  status: string;
  accent: string;
  description: string;
  isPlayable: boolean;
  buttonLabel: string;
  ribbonLabel?: string;
  launchState: 'live' | 'under-construction' | 'coming-soon';
  isFeatured?: boolean;
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

export interface GuessDistributionItem {
  guess: number;
  count: number;
  width: number;
  tone: DistributionTone;
}
