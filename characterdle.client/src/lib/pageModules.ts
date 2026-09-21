import type { Page } from '../types/routes';

// Shared by React.lazy and startup so a direct visit keeps its prerendered HTML
// until the requested page's JavaScript and CSS are ready.
export const pageModules = {
  auth: () => import('../pages/AuthPage').then(module => ({ default: module.AuthPage })),
  launcher: () => import('../pages/LauncherPage').then(module => ({ default: module.LauncherPage })),
  game: () => import('../pages/CharacterGamePage').then(module => ({ default: module.CharacterGamePage })),
  random: () => import('../pages/RandomGamePage').then(module => ({ default: module.RandomGamePage })),
  history: () => import('../pages/PreviousGamesPage').then(module => ({ default: module.PreviousGamesPage })),
  leaderboard: () => import('../pages/LeaderboardPage').then(module => ({ default: module.LeaderboardPage })),
  premium: () => import('../pages/PremiumPage').then(module => ({ default: module.PremiumPage })),
  profile: () => import('../pages/ProfilePage').then(module => ({ default: module.ProfilePage })),
  support: () => import('../pages/SupportPage').then(module => ({ default: module.SupportPage })),
  updates: () => import('../pages/UpdatesPage').then(module => ({ default: module.UpdatesPage })),
  admin: () => import('../pages/AdminPage').then(module => ({ default: module.AdminPage })),
  about: () => import('../pages/AboutPage').then(module => ({ default: module.AboutPage })),
  howToPlay: () => import('../pages/HowToPlayPage').then(module => ({ default: module.HowToPlayPage })),
  privacyPolicy: () => import('../pages/LegalDocumentPage').then(module => ({ default: module.LegalDocumentPage })),
  termsOfService: () => import('../pages/LegalDocumentPage').then(module => ({ default: module.LegalDocumentPage })),
};

type ModulePage = keyof typeof pageModules;
type PageModule<K extends ModulePage> = Awaited<ReturnType<typeof pageModules[K]>>;
type PageComponents = { [K in ModulePage]: PageModule<K>['default'] };
const preparedComponents: Partial<PageComponents> = {};
export const initialPageComponents: Readonly<Partial<PageComponents>> = preparedComponents;

async function preparePage<K extends ModulePage>(page: K) {
  const module = await pageModules[page]();
  preparedComponents[page] = module.default as PageComponents[K];
}

// Bootstrap-only: this selection stays fixed after React mounts. Using the
// resolved component avoids a Suspense fallback even for a prewarmed import.
export async function preloadInitialPage(page: Page) {
  if (page in pageModules) {
    await preparePage(page as ModulePage);
  }
}
