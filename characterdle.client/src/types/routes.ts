import type { GameMode } from './game';

export type Page =
  | 'landing'
  | 'auth'
  | 'launcher'
  | 'game'
  | 'random'
  | 'history'
  | 'leaderboard'
  | 'premium'
  | 'profile'
  | 'support'
  | 'about'
  | 'howToPlay'
  | 'privacyPolicy'
  | 'termsOfService';

export type NavigateToPage = (page: Page) => void;

export type PrimaryAuthMode = 'login' | 'signup';

export type AuthMode = PrimaryAuthMode | 'forgotPassword' | 'resetPassword';

export type RouteGameMode = GameMode;

export interface AppRoute {
  authMode: AuthMode;
  gameId: number | null;
  gameMode: GameMode;
  page: Page;
  universeId: string | null;
}
