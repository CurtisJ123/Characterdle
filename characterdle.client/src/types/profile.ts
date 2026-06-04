import type { GameMode } from './game';

export interface ProfileModeStats {
  mode: GameMode;
  wins: number;
  plays: number;
  losses: number;
  averageGuesses: number | null;
  averageHints: number | null;
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
  averageGuesses: number | null;
  winRate: number;
  overallRank: number | null;
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
