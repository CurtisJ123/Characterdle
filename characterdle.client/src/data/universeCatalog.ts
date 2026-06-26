import type { Universe } from '../types/game';

export const universes: Universe[] = [
  {
    id: 'got',
    title: 'Game of Thrones',
    genre: 'Fantasy',
    status: 'Available now',
    accent: 'var(--universe-got-accent)',
    description: '',
    isPlayable: true,
    buttonLabel: 'Play',
    launchState: 'live',
    isFeatured: true,
  },
  {
    id: 'lotr',
    title: 'Lord of the Rings',
    genre: 'Fantasy',
    status: 'Under construction',
    accent: 'var(--universe-lotr-accent)',
    description: '',
    isPlayable: false,
    buttonLabel: 'Play',
    ribbonLabel: 'Under Construction',
    launchState: 'under-construction',
  },
  {
    id: 'star-wars',
    title: 'Star Wars',
    genre: 'Sci-Fi',
    status: 'Coming soon',
    accent: 'var(--universe-coming-soon-accent)',
    description: '',
    isPlayable: false,
    buttonLabel: 'Coming Soon',
    ribbonLabel: 'Coming Soon',
    launchState: 'coming-soon',
  },
  {
    id: 'wheel-of-time',
    title: 'Wheel of Time',
    genre: 'Fantasy',
    status: 'Coming soon',
    accent: 'var(--universe-coming-soon-accent)',
    description: '',
    isPlayable: false,
    buttonLabel: 'Coming Soon',
    ribbonLabel: 'Coming Soon',
    launchState: 'coming-soon',
  },
  {
    id: 'cosmere',
    title: 'Cosmere',
    genre: 'Fantasy',
    status: 'Coming soon',
    accent: 'var(--universe-coming-soon-accent)',
    description: '',
    isPlayable: false,
    buttonLabel: 'Coming Soon',
    ribbonLabel: 'Coming Soon',
    launchState: 'coming-soon',
  },
];

export const defaultUniverseId = universes.find((universe) => universe.isPlayable)?.id ?? 'got';

export function getUniverseById(universeId: string): Universe | undefined {
  return universes.find((universe) => universe.id === universeId);
}
