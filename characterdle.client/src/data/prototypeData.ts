import type { CharacterGuess, GuessDistributionItem, LeaderboardRow, NavItem, Universe } from '../types/game';

export const navItems: NavItem[] = [
  { id: 'launcher', label: 'Launcher' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'stats', label: 'Stats' },
];

export const asoiafUniverse: Universe = {
  title: 'ASOIAF',
  genre: 'Fantasy',
  status: 'Available now',
  accent: '#f0b429',
  description: 'Character guessing mode for A Song of Ice and Fire.',
};

export const leaderboardRows: LeaderboardRow[] = [
  {
    rank: 1,
    player: 'PlayerOne',
    tier: 'Top player',
    wins: '1,284',
    guesses: '3.2',
    mastery: ['House', 'Region'],
  },
  {
    rank: 2,
    player: 'PlayerTwo',
    tier: 'High accuracy',
    wins: '1,152',
    guesses: '3.8',
    mastery: ['Culture'],
  },
  {
    rank: 3,
    player: 'PlayerThree',
    tier: 'Consistent',
    wins: '942',
    guesses: '4.1',
    mastery: ['Debut book'],
  },
  {
    rank: 4,
    player: 'PlayerFour',
    tier: 'Fast solver',
    wins: '881',
    guesses: '4.3',
    mastery: ['Allegiance'],
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

export const characterGuesses: CharacterGuess[] = [
  {
    name: 'Example Guess 1',
    house: { label: 'House A', tone: 'partial' },
    culture: { label: 'Culture A', tone: 'correct' },
    region: { label: 'Region A', tone: 'correct' },
    allegiance: { label: 'Group A', tone: 'correct' },
    debut: { label: 'Book 1', tone: 'correct' },
  },
  {
    name: 'Example Guess 2',
    house: { label: 'House B', tone: 'neutral' },
    culture: { label: 'Culture B', tone: 'neutral' },
    region: { label: 'Region B', tone: 'partial' },
    allegiance: { label: 'Group B', tone: 'neutral' },
    debut: { label: 'Book 1', tone: 'correct' },
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
