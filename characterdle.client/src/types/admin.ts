export interface AdminDashboardStats {
  generatedAt: string;
  activitySince: string;
  profiles: number;
  newProfiles: number;
  accountsWithCompletedGames: number;
  premium: {
    users: number;
    trialUsers: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
  };
  players: {
    uniquePlayers: number;
    activePlayers: number;
    startedGames: number;
    completedGames: number;
  };
}

export interface AdminComment {
  id: string;
  source: 'update' | 'game';
  contextTitle: string;
  contextUrl: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  isHidden: boolean;
  canModerate: boolean;
}

export interface AdminPlayerProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  membership: 'Free' | 'Trial' | 'Premium';
  lastPlayedAt: string | null;
  currentStreak: number;
  longestStreak: number;
  characterAttempts: number;
  characterWins: number;
  characterWinRate: number;
  characterAverageGuesses: number | null;
  quoteAttempts: number;
  quoteWins: number;
  quoteWinRate: number;
  quoteAverageGuesses: number | null;
  ladderPoints: number;
  ladderDaysPlayed: number;
  ladderPointsPerDay: number;
}
