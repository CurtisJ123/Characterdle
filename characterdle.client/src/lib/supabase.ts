import { createClient, processLock } from '@supabase/supabase-js';

function readRuntimeConfig() {
  const runtimeConfig = window.__CHARACTERDLE_PUBLIC_CONFIG__;

  if (!runtimeConfig?.supabaseUrl || !runtimeConfig.supabasePublishableKey) {
    throw new Error('Characterdle runtime config is missing Supabase settings.');
  }

  return runtimeConfig;
}

const runtimeConfig = readRuntimeConfig();

export const supabase = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
  auth: {
    lock: processLock,
    storageKey: 'characterdle-auth',
  },
});
