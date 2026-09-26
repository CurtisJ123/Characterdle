import type { UniverseProfile } from '../../src/types/profile';

export function createProfileFixture(): UniverseProfile {
  return {
    universeId: 'got', universeName: 'Game of Thrones', userId: '00000000-0000-4000-8000-000000000001',
    displayName: 'Fixture Player', email: 'fixture@example.test', avatarUrl: '/android-chrome-512x512.png',
    memberSince: '2026-09-01T00:00:00Z', totalWins: 7, totalPlays: 10, totalLosses: 2,
    totalCompletionRate: 10, averageGuesses: 2.4, overallRank: 3, currentStreak: 14, longestStreak: 21,
    character: { mode: 'character', wins: 2, plays: 4, losses: 1, averageGuesses: 4,
      averageHints: 0.75, completionRate: 20, rank: 3 },
    quote: { mode: 'quote', wins: 1, plays: 1, losses: 0, averageGuesses: 2,
      averageHints: 0, completionRate: 10, rank: 2 },
    episodeLadder: { wins: 4, plays: 5, losses: 1, averageAttempts: 2, completionRate: 8,
      totalPoints: 56, daysPlayed: 2, pointsPerDay: 28, rank: 2 },
    recentResults: [
      { gameId: 10, mode: 'episode_ladder', status: 'won', guessCount: 1, hintCount: 0,
        completedAt: '2026-09-25T16:00:00Z', difficulty: 5, points: 30 },
      { gameId: 10, mode: 'episode_ladder', status: 'won', guessCount: 4, hintCount: 0,
        completedAt: '2026-09-25T15:00:00Z', difficulty: 4, points: 7 },
      { gameId: 10, mode: 'episode_ladder', status: 'lost', guessCount: 4, hintCount: 0,
        completedAt: '2026-09-25T14:00:00Z', difficulty: 3, points: 0 },
      { gameId: 9, mode: 'episode_ladder', status: 'won', guessCount: 2, hintCount: 0,
        completedAt: '2026-09-24T17:00:00Z', difficulty: 2, points: 9 },
      { gameId: 9, mode: 'episode_ladder', status: 'won', guessCount: 1, hintCount: 0,
        completedAt: '2026-09-24T16:00:00Z', difficulty: 1, points: 10 },
      { gameId: 9, mode: 'quote', status: 'won', guessCount: 2, hintCount: 0,
        completedAt: '2026-09-24T15:00:00Z' },
      { gameId: 9, mode: 'character', status: 'lost', guessCount: 6, hintCount: 1,
        completedAt: '2026-09-24T14:00:00Z' },
      { gameId: 8, mode: 'character', status: 'won', guessCount: 12, hintCount: 2,
        completedAt: '2026-09-24T13:00:00Z' },
    ],
  };
}
