export type Page = 'landing' | 'auth' | 'launcher' | 'game' | 'quote' | 'history' | 'leaderboard';

export type NavigateToPage = (page: Page) => void;

export type AuthMode = 'login' | 'signup';
