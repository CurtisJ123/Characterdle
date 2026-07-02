import type { Page } from './routes';

export type AttributeTone = 'correct' | 'partial' | 'neutral';
export type GameMode = 'character' | 'quote';

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

export interface CharacterAttribute {
  displayVariant?: 'default' | 'numeric';
  isNewlyDiscovered?: boolean;
  isRevealing?: boolean;
  label: string;
  revealOrder?: number;
  tone: AttributeTone;
  indicator?: {
    direction: 'up' | 'down';
    value: string;
  };
}
