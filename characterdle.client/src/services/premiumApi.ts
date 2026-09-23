import { buildApiUrl } from '../lib/runtimeConfig';
import { AccountApiError } from '../lib/accountResource';
import type { PremiumState } from '../types/premium';

async function throwPremiumApiError(response: Response, fallbackMessage: string): Promise<never> {
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
    // Use the fallback message when the response body is not JSON.
  }

  throw new AccountApiError(message, response.status);
}

export async function getPremiumState(accessToken: string, signal?: AbortSignal): Promise<PremiumState> {
  const response = await fetch(buildApiUrl('/api/premium'), {
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwPremiumApiError(response, `Premium request failed with ${response.status}.`);
  }

  return await response.json() as PremiumState;
}
