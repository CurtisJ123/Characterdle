import { premiumResource } from '../lib/accountData';
import { getPremiumState } from '../services/premiumApi';
import { useAccountResource } from './useAccountResource';
import type { PremiumStateResult } from '../types/premium';

export function usePremium(accessToken: string | null, userId: string | null): PremiumStateResult {
  return useAccountResource(premiumResource, userId, accessToken, 'premium', getPremiumState);
}
