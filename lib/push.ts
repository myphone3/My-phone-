import webpush from 'web-push';
import { supabase } from '@/lib/supabase';

// שליחת התראה לטלפונים של המנהלים (צד שרת בלבד).
import { VAPID_PUBLIC_KEY } from '@/lib/vapid';

export async function pushToAdmins(payload: { title: string; body: string; url: string; tag?: string }) {
  const secret = process.env.CRON_SECRET;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !privateKey) return { sent: 0, skipped: 'not configured' };
  webpush.setVapidDetails('mailto:' + (process.env.GMAIL_USER || 'store@example.com'), VAPID_PUBLIC_KEY, privateKey);

  const { data, error } = await supabase.rpc('order_push_targets', { p_secret: secret });
  if (error) return { sent: 0, error: error.message };
  let sent = 0;
  await Promise.all(
    ((data as any[]) || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400, urgency: 'high' });
        sent++;
      } catch (err: any) {
        // המנוי פג (הסירו הרשאה / מחקו את האפליקציה): מוחקים אותו
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.rpc('drop_push_target', { p_secret: secret, p_endpoint: s.endpoint });
        }
      }
    })
  );
  return { sent };
}
