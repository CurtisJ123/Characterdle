import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvdybelcnbrrkwwktbys.supabase.co';
const supabasePublishableKey = 'sb_publishable_Chmzjcup3wZDhMxcMa1SLQ_uszYc8rB';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    lock: processLock,
    storageKey: 'characterdle-auth',
  },
});
