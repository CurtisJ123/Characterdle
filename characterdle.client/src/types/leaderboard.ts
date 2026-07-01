import type { GameMode } from './game';

export interface LeaderboardModeOverview {
  playerCount: number;
  totalPlays: number;
  totalWins: number;
  averageGuesses: number | null;
}

export interface LeaderboardOverview {
  playerCount: number;
  totalPlays: number;
  totalWins: number;
  totalCharacterWins: number;
  totalQuoteWins: number;
  averageGuesses: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalWins: number;
  characterWins: number;
  quoteWins: number;
  totalPlays: number;
  characterPlays: number;
  quotePlays: number;
  averageGuesses: number | null;
  characterAverageGuesses: number | null;
  quoteAverageGuesses: number | null;
  winRate: number;
  isCurrentUser: boolean;
}

export interface UniverseLeaderboard {
  universeId: string;
  universeName: string;
  overview: LeaderboardOverview;
  characterOverview: LeaderboardModeOverview;
  quoteOverview: LeaderboardModeOverview;
  currentUser: LeaderboardEntry | null;
  rows: LeaderboardEntry[];
}

export interface UniverseLeaderboardState {
  data: UniverseLeaderboard | null;
  error: Error | null;
  isLoading: boolean;
}

export interface SubmitUniverseGameResultPayload {
  gameId: number;
  guessCount: number;
  guessedCharacterIds: number[];
  hintCount: number;
  mode: GameMode;
  revealedHintKeys: string[];
  status: 'playing' | 'won' | 'lost';
  universeId: string;
}

export interface ModeLeaderboardEntry {
  averageGuesses: number | null;
  avatarUrl: string | null;
  displayName: string;
  isCurrentUser: boolean;
  plays: number;
  rank: number;
  totalWins: number;
  userId: string;
  wins: number;
}
