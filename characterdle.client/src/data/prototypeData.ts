import type { CharacterGuess, GuessDistributionItem, LeaderboardRow, NavItem, Universe } from '../types/game';

export const navItems: NavItem[] = [
  { id: 'launcher', label: 'Launcher' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'stats', label: 'Stats' },
];

export const asoiafUniverse: Universe = {
  title: 'ASOIAF',
  genre: 'Fantasy',
  status: 'Daily live',
  accent: '#f0b429',
  description: 'Guess characters from Westeros and Essos using houses, cultures, regions, allegiances, and book clues.',
};

export const leaderboardRows: LeaderboardRow[] = [
  {
    rank: 1,
    player: 'CrowCaller',
    tier: 'Maester',
    wins: '1,284',
    guesses: '3.2',
    mastery: ['The North', 'Night Watch'],
  },
  {
    rank: 2,
    player: 'DragonSeed',
    tier: 'Archmaester',
    wins: '1,152',
    guesses: '3.8',
    mastery: ['Targaryen'],
  },
  {
    rank: 3,
    player: 'NeedleMain',
    tier: 'Gold Cloak',
    wins: '942',
    guesses: '4.1',
    mastery: ['Stark'],
  },
  {
    rank: 4,
    player: 'RedKeepRiddler',
    tier: 'Small Council',
    wins: '881',
    guesses: '4.3',
    mastery: ['King Landing'],
  },
  {
    rank: 5,
    player: 'SeaStoneChair',
    tier: 'Ironborn',
    wins: '754',
    guesses: '4.5',
    mastery: ['Greyjoy'],
  },
];

export const characterGuesses: CharacterGuess[] = [
  {
    name: 'Jon Snow',
    house: { label: 'Stark', tone: 'partial' },
    culture: { label: 'Northmen', tone: 'correct' },
    region: { label: 'The Wall', tone: 'correct' },
    allegiance: { label: 'Night Watch', tone: 'correct' },
    debut: { label: 'AGOT', tone: 'correct' },
  },
  {
    name: 'Daenerys Targaryen',
    house: { label: 'Targaryen', tone: 'neutral' },
    culture: { label: 'Valyrian', tone: 'neutral' },
    region: { label: 'Essos', tone: 'partial' },
    allegiance: { label: 'House Targaryen', tone: 'neutral' },
    debut: { label: 'AGOT', tone: 'correct' },
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
