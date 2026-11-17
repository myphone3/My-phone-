import { createClient } from '@supabase/supabase-js';

// כניסה עם Google נשמרת בטלפון (מפתח נפרד מהחנות). בלי כניסה — הכל עובד כמו קודם עם הקישור.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'wr-auth' },
});
