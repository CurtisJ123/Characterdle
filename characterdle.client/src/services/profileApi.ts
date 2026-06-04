import type { UniverseProfile } from '../types/profile';
import { buildApiUrl } from '../lib/runtimeConfig';

export async function getProfile(
  accessToken: string,
  universeId: string,
): Promise<UniverseProfile> {
  const response = await fetch(buildApiUrl(`/api/profile/${encodeURIComponent(universeId)}`), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Profile request failed with ${response.status}.`);
  }

  return await response.json() as UniverseProfile;
}
