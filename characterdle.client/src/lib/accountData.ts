import { AccountResource } from './accountResource';
import type { PremiumState } from '../types/premium';
import type { UniverseProfile } from '../types/profile';

export const premiumResource = new AccountResource<PremiumState>();
export const profileResource = new AccountResource<UniverseProfile>();

export function clearAccountData() {
  premiumResource.clear();
  profileResource.clear();
}
