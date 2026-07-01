import type { GameMode } from './game';

export interface ProfileModeStats {
  mode: GameMode;
  wins: number;
  plays: number;
  losses: number;
  averageGuesses: number | null;
  averageHints: number | null;
  completionRate: number;
  rank: number | null;
}

export interface ProfileRecentResult {
  gameId: number;
  mode: GameMode;
  status: 'won' | 'lost';
  guessCount: number;
  hintCount: number;
  completedAt: string;
}

export interface PersistedGameResult {
  gameId: number;
  mode: GameMode;
  status: 'playing' | 'won' | 'lost';
  guessCount: number;
  guessedCharacterIds: number[];
  hintCount: number;
  revealedHintKeys: string[];
  completedAt: string | null;
  updatedAt: string;
}

export interface ProfileGameResultsState {
  data: PersistedGameResult[];
  error: Error | null;
  isLoading: boolean;
}

export interface UniverseProfile {
  universeId: string;
  universeName: string;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  memberSince: string;
  totalWins: number;
  totalPlays: number;
  totalLosses: number;
  totalCompletionRate: number;
  averageGuesses: number | null;
  overallRank: number | null;
  currentStreak: number;
  longestStreak: number;
  character: ProfileModeStats;
  quote: ProfileModeStats;
  recentResults: ProfileRecentResult[];
}

export interface ProfileState {
  data: UniverseProfile | null;
  error: Error | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}
