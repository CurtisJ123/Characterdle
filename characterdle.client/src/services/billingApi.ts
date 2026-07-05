import { buildApiUrl } from '../lib/runtimeConfig';
import type { BillingCheckoutPlan } from '../types/billing';

interface BillingSessionResponse {
  url: string;
}

async function throwBillingApiError(response: Response, fallbackMessage: string): Promise<never> {
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
    // Use the fallback message if the response body isn't JSON.
  }

  throw new Error(message);
}

export async function createBillingCheckoutSession(
  accessToken: string,
  plan: BillingCheckoutPlan,
): Promise<string> {
  const response = await fetch(buildApiUrl('/api/billing/checkout'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) {
    await throwBillingApiError(response, `Billing checkout request failed with ${response.status}.`);
  }

  const payload = await response.json() as BillingSessionResponse;

  if (typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Stripe checkout did not return a redirect URL.');
  }

  return payload.url;
}

export async function createBillingPortalSession(accessToken: string): Promise<string> {
  const response = await fetch(buildApiUrl('/api/billing/portal'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwBillingApiError(response, `Billing portal request failed with ${response.status}.`);
  }

  const payload = await response.json() as BillingSessionResponse;

  if (typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Stripe billing portal did not return a redirect URL.');
  }

  return payload.url;
}
