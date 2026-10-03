export const ladderGuestStorageKey = 'episode-ladder-guest-id';
let fallbackGuestId: string | undefined;
export function ladderGuestId(): string {
  try {
    const existing = localStorage.getItem(ladderGuestStorageKey);
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)
      && existing !== '00000000-0000-0000-0000-000000000000') return existing.toLowerCase();
    const id = fallbackGuestId ??= crypto.randomUUID();
    localStorage.setItem(ladderGuestStorageKey, id);
    return id;
  } catch { return fallbackGuestId ??= crypto.randomUUID(); }
}
export function leaderboardScope(token: string | null, accountScope: string): string {
  return token ? `user:${accountScope}` : `guest:${ladderGuestId()}`;
}
export function leaderboardHeaders(token: string | null): Record<string, string> {
  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` }
    : { 'X-Leaderboard-Guest-Id': ladderGuestId() }) };
}
