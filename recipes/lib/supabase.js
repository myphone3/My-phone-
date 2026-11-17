import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  // heartbeat קצר: מגלים מהר חיבור שנפל ומתחברים מחדש
  realtime: { params: { eventsPerSecond: 20 }, heartbeatIntervalMs: 15000 },
});
