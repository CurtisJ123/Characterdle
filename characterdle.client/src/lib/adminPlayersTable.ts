import type { AdminPlayerProfile } from '../types/admin';
import type { CatalogColumn } from './adminCatalogTable';

export const playerColumns: CatalogColumn<AdminPlayerProfile>[] = [
  { key: 'displayName', label: 'Username', kind: 'readonly', wide: true, value: r => r.displayName },
  { key: 'email', label: 'Email', kind: 'readonly', wide: true, value: r => r.email },
  { key: 'membership', label: 'Membership', kind: 'readonly', value: r => r.membership },
  { key: 'createdAt', label: 'Joined', kind: 'readonly', value: r => Date.parse(r.createdAt), search: r => playerDate(r.createdAt) },
  { key: 'lastPlayedAt', label: 'Last played', kind: 'readonly', value: r => r.lastPlayedAt ? Date.parse(r.lastPlayedAt) : null, search: r => playerDate(r.lastPlayedAt) },
  { key: 'currentStreak', label: 'Current streak', kind: 'readonly', value: r => r.currentStreak },
  { key: 'longestStreak', label: 'Longest streak', kind: 'readonly', value: r => r.longestStreak },
  { key: 'characterAttempts', label: 'Character attempts', kind: 'readonly', value: r => r.characterAttempts },
  { key: 'characterWins', label: 'Character wins', kind: 'readonly', value: r => r.characterWins },
  { key: 'characterWinRate', label: 'Character win rate', kind: 'readonly', value: r => r.characterWinRate, search: r => `${r.characterWinRate}%` },
  { key: 'characterAverageGuesses', label: 'Character avg. guesses', kind: 'readonly', value: r => r.characterAverageGuesses },
  { key: 'quoteAttempts', label: 'Quote attempts', kind: 'readonly', value: r => r.quoteAttempts },
  { key: 'quoteWins', label: 'Quote wins', kind: 'readonly', value: r => r.quoteWins },
  { key: 'quoteWinRate', label: 'Quote win rate', kind: 'readonly', value: r => r.quoteWinRate, search: r => `${r.quoteWinRate}%` },
  { key: 'quoteAverageGuesses', label: 'Quote avg. guesses', kind: 'readonly', value: r => r.quoteAverageGuesses },
  { key: 'ladderPoints', label: 'Ladder points', kind: 'readonly', value: r => r.ladderPoints },
  { key: 'ladderDaysPlayed', label: 'Ladder days played', kind: 'readonly', value: r => r.ladderDaysPlayed },
  { key: 'ladderPointsPerDay', label: 'Ladder points / day', kind: 'readonly', value: r => r.ladderPointsPerDay },
  { key: 'id', label: 'User ID', kind: 'readonly', wide: true, value: r => r.id },
];

// Display and filter the same unambiguous UTC date; sort using its numeric timestamp.
export function playerDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'Never';
}
