import { createClient, processLock } from '@supabase/supabase-js';
import { readPublicConfig } from './runtimeConfig';

const runtimeConfig = readPublicConfig();

export const supabase = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
  auth: {
    lock: processLock,
    storageKey: 'characterdle-auth',
  },
});
