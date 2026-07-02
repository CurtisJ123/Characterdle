import type { UniverseProfile } from '../types/profile';
import type { PersistedGameResult } from '../types/profile';
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
): Promise<PersistedGameResult[]> {
  const response = await fetch(buildApiUrl(`/api/profile/${encodeURIComponent(universeId)}/results`), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Profile game results request failed with ${response.status}.`);
  }

  return await response.json() as PersistedGameResult[];
}

export async function updateProfileSettings(
  accessToken: string,
  displayName: string,
  avatarUrl: string | null,
): Promise<void> {
  const response = await fetch(buildApiUrl('/api/profile'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      avatarUrl,
      displayName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Profile update request failed with ${response.status}.`);
  }
}
