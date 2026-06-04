export interface CharacterdlePublicConfig {
  apiBaseUrl?: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

function normalizeApiBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? '';
}

function readBuildTimeConfig(): CharacterdlePublicConfig | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
    supabasePublishableKey,
    supabaseUrl,
  };
}

export function getBuildTimePublicConfig(): CharacterdlePublicConfig | null {
  return readBuildTimeConfig();
}

export function readPublicConfig(): CharacterdlePublicConfig {
  const runtimeConfig = window.__CHARACTERDLE_PUBLIC_CONFIG__ ?? readBuildTimeConfig();

  if (!runtimeConfig?.supabaseUrl || !runtimeConfig.supabasePublishableKey) {
    throw new Error('Characterdle runtime config is missing Supabase settings.');
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(runtimeConfig.apiBaseUrl),
    supabasePublishableKey: runtimeConfig.supabasePublishableKey,
    supabaseUrl: runtimeConfig.supabaseUrl,
  };
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;
  const apiBaseUrl = readPublicConfig().apiBaseUrl;

  return apiBaseUrl
    ? `${apiBaseUrl}${normalizedPath}`
    : normalizedPath;
}
