import type { GuessDistributionItem, LeaderboardRow, NavItem } from '../types/game';

export const navItems: NavItem[] = [
  { id: 'launcher', label: 'Launcher' },
  { id: 'history', label: 'Previous Games' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export const leaderboardRows: LeaderboardRow[] = [
  {
    rank: 1,
    player: 'PlayerOne',
    tier: 'Top player',
    wins: '1,284',
    guesses: '3.2',
    mastery: ['House', 'Occupation'],
  },
  {
    rank: 2,
    player: 'PlayerTwo',
    tier: 'High accuracy',
    wins: '1,152',
    guesses: '3.8',
    mastery: ['Species'],
  },
  {
    rank: 3,
    player: 'PlayerThree',
    tier: 'Consistent',
    wins: '942',
    guesses: '4.1',
    mastery: ['Debut season'],
  },
  {
    rank: 4,
    player: 'PlayerFour',
    tier: 'Fast solver',
    wins: '881',
    guesses: '4.3',
    mastery: ['Last season'],
  },
  {
    rank: 5,
    player: 'PlayerFive',
    tier: 'Rising',
    wins: '754',
    guesses: '4.5',
    mastery: ['Mixed clues'],
  },
];

export const guessDistribution: GuessDistributionItem[] = [
  { guess: 1, count: 3, width: 8, tone: 'muted' },
  { guess: 2, count: 18, width: 22, tone: 'muted' },
  { guess: 3, count: 52, width: 66, tone: 'primary' },
  { guess: 4, count: 31, width: 40, tone: 'muted' },
  { guess: 5, count: 11, width: 18, tone: 'muted' },
  { guess: 6, count: 2, width: 6, tone: 'danger' },
];
