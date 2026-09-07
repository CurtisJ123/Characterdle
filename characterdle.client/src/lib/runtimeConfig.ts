export interface CharacterdlePublicConfig {
  apiBaseUrl?: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

const PRODUCTION_API_ORIGIN = 'https://characterdle-api-vtnh.onrender.com';
const PRODUCTION_SUPABASE_PROJECT_REFERENCE = 'lvdybelcnbrrkwwktbys';

function normalizeApiBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? '';
}

export function assertSafeLocalPublicConfig(config: CharacterdlePublicConfig): CharacterdlePublicConfig {
  if (!import.meta.env.DEV) {
    return config;
  }

  const apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl);
  const usesProductionSupabase = config.supabaseUrl.includes(PRODUCTION_SUPABASE_PROJECT_REFERENCE);
  const usesProductionApi = apiBaseUrl.startsWith(PRODUCTION_API_ORIGIN);

  if (usesProductionSupabase || usesProductionApi) {
    throw new Error('Local development is blocked from using Characterdle production services. Configure staging values instead.');
  }

  return config;
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
  const config = readBuildTimeConfig();

  return config ? assertSafeLocalPublicConfig(config) : null;
}

export function readPublicConfig(): CharacterdlePublicConfig {
  const runtimeConfig = window.__CHARACTERDLE_PUBLIC_CONFIG__ ?? readBuildTimeConfig();

  if (!runtimeConfig?.supabaseUrl || !runtimeConfig.supabasePublishableKey) {
    throw new Error('Characterdle runtime config is missing Supabase settings.');
  }

  return assertSafeLocalPublicConfig({
    apiBaseUrl: normalizeApiBaseUrl(runtimeConfig.apiBaseUrl),
    supabasePublishableKey: runtimeConfig.supabasePublishableKey,
    supabaseUrl: runtimeConfig.supabaseUrl,
  });
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
