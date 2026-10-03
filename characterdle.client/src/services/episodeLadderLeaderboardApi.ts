import { buildApiUrl } from '../lib/runtimeConfig';
import { leaderboardHeaders, leaderboardScope } from '../lib/guestIdentity';
import { LeaderboardResource, type LeaderboardSnapshot } from '../lib/leaderboardResource';
import type { EpisodeLadderLeaderboardData } from '../types/leaderboard';

export type EpisodeLadderLeaderboardSnapshot = LeaderboardSnapshot<EpisodeLadderLeaderboardData>;
export const episodeLadderLeaderboardResource = new LeaderboardResource<EpisodeLadderLeaderboardData>();
export const emptyEpisodeLadderLeaderboard = episodeLadderLeaderboardResource.empty;
export const subscribeEpisodeLadderLeaderboard = episodeLadderLeaderboardResource.subscribe;
export const episodeLeaderboardKey = (universe: string, token: string | null, scope: string) => JSON.stringify([universe, leaderboardScope(token, scope)]);

export function getEpisodeLadderLeaderboardSnapshot(universe: string, scope: string, token: string | null = scope === 'guest' ? null : 'authenticated') {
  return episodeLadderLeaderboardResource.peek(episodeLeaderboardKey(universe, token, scope));
}
export function clearEpisodeLadderLeaderboardCache(universe?: string, scope?: string) {
  episodeLadderLeaderboardResource.clear(key => {
    const [storedUniverse, identity] = JSON.parse(key) as string[];
    return (!universe || universe === storedUniverse) && (!scope || identity === `user:${scope}` || identity === scope || (scope === 'guest' && identity.startsWith('guest:')));
  });
}
export function getEpisodeLadderLeaderboard(universeId: string, accessToken: string | null, requestScope: string): Promise<EpisodeLadderLeaderboardData> {
  return episodeLadderLeaderboardResource.load(episodeLeaderboardKey(universeId, accessToken, requestScope), async signal => {
    const response = await fetch(buildApiUrl(`/api/universes/${encodeURIComponent(universeId)}/leaderboard/episode-ladder`), {
      headers: leaderboardHeaders(accessToken), cache: 'no-store', signal,
    });
    if (!response.ok) throw new Error('Unable to load Episode Ladder leaderboard. Please try again.');
    return await response.json() as EpisodeLadderLeaderboardData;
  });
}
