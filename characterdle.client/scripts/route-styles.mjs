export const pageEntries = {
  auth: 'src/pages/AuthPage.tsx',
  launcher: 'src/pages/LauncherPage.tsx',
  game: 'src/pages/CharacterGamePage.tsx',
  random: 'src/pages/RandomGamePage.tsx',
  history: 'src/pages/PreviousGamesPage.tsx',
  leaderboard: 'src/pages/LeaderboardPage.tsx',
  premium: 'src/pages/PremiumPage.tsx',
  profile: 'src/pages/ProfilePage.tsx',
  support: 'src/pages/SupportPage.tsx',
  updates: 'src/pages/UpdatesPage.tsx',
  admin: 'src/pages/AdminPage.tsx',
  about: 'src/pages/AboutPage.tsx',
  howToPlay: 'src/pages/HowToPlayPage.tsx',
  privacyPolicy: 'src/pages/LegalDocumentPage.tsx',
  termsOfService: 'src/pages/LegalDocumentPage.tsx',
};

// Follow static dependencies only. Walking dynamicImports would put every
// secondary page's CSS back on the initial loading path.
export function collectStyles(manifest, entries) {
  const visited = new Set();
  const styles = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing build manifest entry: ${key}`);
    for (const dependency of entry.imports ?? []) visit(dependency);
    for (const file of entry.css ?? []) styles.add(file);
  }
  for (const entry of entries) visit(entry);
  return [...styles];
}
