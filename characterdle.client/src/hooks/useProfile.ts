import { profileResource } from '../lib/accountData';
import { getProfile } from '../services/profileApi';
import { useAccountResource } from './useAccountResource';
import type { ProfileState } from '../types/profile';

export function useProfile(accessToken: string | null, universeId: string, userId: string | null): ProfileState {
  return useAccountResource(profileResource, userId, accessToken, universeId,
    (token, signal) => getProfile(token, universeId, signal));
}
