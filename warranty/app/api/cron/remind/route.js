// רץ פעם ביום (Vercel Cron): שולח התראה על מוצרים שהאחריות שלהם נגמרת בעוד חודש / שבוע
import { createClient } from '@supabase/supabase-js';
import { pusher } from '@/lib/webpush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const wp = pusher();
  if (!wp) return Response.json({ error: 'no-push' }, { status: 503 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('wr_push_due', { p_secret: secret });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // מקבצים לפי טלפון: התראה אחת לכל מוצר
  let sent = 0, failed = 0;
  const gone = new Set();
  await Promise.all((data || []).map(async (d) => {
    const name = d.product || d.store || 'מוצר';
    const when = d.days === 0 ? 'היום' : d.days === 1 ? 'מחר' : `בעוד ${d.days} ימים`;
    try {
      await wp.sendNotification(d.sub, JSON.stringify({
        title: d.kind === '7' ? `⏰ האחריות על ${name} נגמרת ${when}` : `🛡️ האחריות על ${name} נגמרת ${when}`,
        body: `${d.store ? 'נקנה ב' + d.store + '. ' : ''}הכול עובד תקין? אם יש תקלה — זה הזמן לפנות לתיקון בחינם.`,
        url: `/v/${d.vault_id}?r=${d.id}`, tag: 'wr-' + d.id,
      }), { TTL: 86400 });
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) gone.add(d.endpoint);
    }
  }));
  await Promise.all([...gone].map((ep) => db.rpc('wr_push_gone', { p_secret: secret, p_endpoint: ep })));
  return Response.json({ due: (data || []).length, sent, failed, removed: gone.size });
}
