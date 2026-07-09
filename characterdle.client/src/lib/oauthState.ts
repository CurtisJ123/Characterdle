import { getPrimarySiteOrigin } from './siteRouting';

const OAUTH_STATE_STORAGE_KEY = 'characterdle:pending-oauth';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface PendingOAuthState {
  createdAt: number;
  provider: 'google';
  returnPath: string;
}

function readPendingOAuthState(): PendingOAuthState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingOAuthState>;

    if (
      parsed.provider !== 'google'
      || typeof parsed.createdAt !== 'number'
      || !Number.isFinite(parsed.createdAt)
      || typeof parsed.returnPath !== 'string'
      || !parsed.returnPath.trim()
    ) {
      window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
      return null;
    }

    if (Date.now() - parsed.createdAt > OAUTH_STATE_TTL_MS) {
      window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      provider: parsed.provider,
      returnPath: parsed.returnPath,
    };
  } catch {
    window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
    return null;
  }
}

export function buildOAuthRedirectUrl(): string {
  const redirectUrl = new URL(getPrimarySiteOrigin());

  if (typeof window !== 'undefined') {
    redirectUrl.pathname = window.location.pathname;
    redirectUrl.search = window.location.search;
  }

  redirectUrl.hash = '';
  return redirectUrl.toString();
}

export function markPendingOAuthRedirect(provider: PendingOAuthState['provider']): void {
  if (typeof window === 'undefined') {
    return;
  }

  const state: PendingOAuthState = {
    createdAt: Date.now(),
    provider,
    returnPath: `${window.location.pathname}${window.location.search}`,
  };

  window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function clearPendingOAuthRedirect(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
}

export function consumePendingOAuthRedirect(
  provider: PendingOAuthState['provider'],
): boolean {
  const state = readPendingOAuthState();

  if (
    !state
    || state.provider !== provider
    || typeof window === 'undefined'
    || state.returnPath !== `${window.location.pathname}${window.location.search}`
  ) {
    return false;
  }

  clearPendingOAuthRedirect();
  return true;
}

export function hasPendingOAuthRedirectForCurrentPath(
  provider: PendingOAuthState['provider'],
): boolean {
  const state = readPendingOAuthState();

  return Boolean(
    state
    && typeof window !== 'undefined'
    && state.provider === provider
    && state.returnPath === `${window.location.pathname}${window.location.search}`,
  );
}
