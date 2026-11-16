// התראת ניסיון מיד אחרי ההפעלה, כדי לראות שזה עובד
import { pusher } from '@/lib/webpush';

export const runtime = 'nodejs';

export async function POST(req) {
  const wp = pusher();
  if (!wp) return Response.json({ error: 'no-push' }, { status: 503 });
  const { sub, vault } = await req.json().catch(() => ({}));
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !/^[0-9a-f-]{36}$/i.test(vault || '')) return Response.json({ error: 'bad' }, { status: 400 });
  try {
    await wp.sendNotification(sub, JSON.stringify({
      title: '🛡️ ההתראות הופעלו',
      body: 'נזכיר לך חודש ושבוע לפני שהאחריות על מוצר נגמרת',
      url: `/v/${vault}`, tag: 'wr-test',
    }), { TTL: 3600 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e.statusCode || e.message) }, { status: 502 });
  }
}
