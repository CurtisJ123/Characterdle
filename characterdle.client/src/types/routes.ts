import type { GameMode } from './game';

export type Page = 'landing' | 'auth' | 'launcher' | 'game' | 'history' | 'leaderboard' | 'profile';

export type NavigateToPage = (page: Page) => void;

export type AuthMode = 'login' | 'signup';

export type RouteGameMode = GameMode;
