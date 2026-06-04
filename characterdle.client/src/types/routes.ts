import type { GameMode } from './game';

export type Page = 'landing' | 'auth' | 'launcher' | 'game' | 'history' | 'leaderboard' | 'profile';

export type NavigateToPage = (page: Page) => void;

export type PrimaryAuthMode = 'login' | 'signup';

export type AuthMode = PrimaryAuthMode | 'forgotPassword' | 'resetPassword';

export type RouteGameMode = GameMode;
