export type Page = 'landing' | 'auth' | 'launcher' | 'game' | 'quote' | 'leaderboard' | 'stats';

export type NavigateToPage = (page: Page) => void;

export type AuthMode = 'login' | 'signup';
