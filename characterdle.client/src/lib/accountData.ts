import { AccountResource } from './accountResource';
import type { PremiumState } from '../types/premium';
import type { UniverseProfile } from '../types/profile';
import { clearLeaderboardCache } from '../services/leaderboardApi';

export const premiumResource = new AccountResource<PremiumState>();
export const profileResource = new AccountResource<UniverseProfile>(Date.now, 45_000);

export function clearAccountData() {
  clearLeaderboardCache();
  premiumResource.clear();
  profileResource.clear();
}
