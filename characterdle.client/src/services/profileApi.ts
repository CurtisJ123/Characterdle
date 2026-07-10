import type { AccountDeletionStatus } from '../types/auth';
import type { UniverseProfile } from '../types/profile';
import type { PersistedGameResult } from '../types/profile';
import { buildApiUrl } from '../lib/runtimeConfig';

async function throwProfileApiError(response: Response, fallbackMessage: string): Promise<never> {
  let message = fallbackMessage;

  try {
    const payload = await response.json() as {
      detail?: string;
      errors?: Record<string, string[]>;
      message?: string;
      title?: string;
    };

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      message = payload.detail.trim();
    } else if (typeof payload.message === 'string' && payload.message.trim()) {
      message = payload.message.trim();
    } else {
      const firstValidationMessage = payload.errors
        ? Object.values(payload.errors).flat().find((value) => typeof value === 'string' && value.trim())
        : null;

      if (firstValidationMessage) {
        message = firstValidationMessage.trim();
      } else if (typeof payload.title === 'string' && payload.title.trim()) {
        message = payload.title.trim();
      }
    }
  } catch {
    // Fall back to the default message when the response body is not JSON.
  }

  throw new Error(message);
}

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
    await throwProfileApiError(response, `Profile request failed with ${response.status}.`);
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
    await throwProfileApiError(response, `Profile game results request failed with ${response.status}.`);
  }

  return await response.json() as PersistedGameResult[];
}

export async function updateProfileSettings(
  accessToken: string,
  displayName: string,
  avatarUrl: string | null | undefined,
  autoUseStreakSavers: boolean,
): Promise<void> {
  const shouldUpdateAvatar = avatarUrl !== undefined;

  const response = await fetch(buildApiUrl('/api/profile'), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      autoUseStreakSavers,
      displayName,
      ...(shouldUpdateAvatar ? { avatarUrl } : {}),
      updateAvatar: shouldUpdateAvatar,
    }),
  });

  if (!response.ok) {
    await throwProfileApiError(response, `Profile update request failed with ${response.status}.`);
  }
}

export async function getAccountDeletionStatus(accessToken: string): Promise<AccountDeletionStatus> {
  const response = await fetch(buildApiUrl('/api/profile/account-deletion'), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwProfileApiError(response, `Account deletion status request failed with ${response.status}.`);
  }

  return await response.json() as AccountDeletionStatus;
}

export async function deleteProfileAccount(accessToken: string): Promise<void> {
  const response = await fetch(buildApiUrl('/api/profile'), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwProfileApiError(response, `Account deletion request failed with ${response.status}.`);
  }
}
