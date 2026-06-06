import type { UniverseProfile } from '../types/profile';
import type { ProfileRecentResult } from '../types/profile';
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

export async function getGameResults(
  accessToken: string,
  universeId: string,
): Promise<ProfileRecentResult[]> {
  const response = await fetch(buildApiUrl(`/api/profile/${encodeURIComponent(universeId)}/results`), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Profile game results request failed with ${response.status}.`);
  }

  return await response.json() as ProfileRecentResult[];
}

export async function updateProfileDisplayName(
  accessToken: string,
  displayName: string,
): Promise<void> {
  const response = await fetch(buildApiUrl('/api/profile'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      displayName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Profile update request failed with ${response.status}.`);
  }
}
