// שולח התראה לטלפונים של שאר המשתתפים ברשימה (גם כשהאפליקציה סגורה)
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return Response.json({ sent: 0, reason: 'no-vapid' });
  let body;
  try { body = await req.json(); } catch { return Response.json({ sent: 0 }, { status: 400 }); }
  const { list, by, title, text } = body || {};
  if (!/^[0-9a-f-]{36}$/i.test(list || '')) return Response.json({ sent: 0 }, { status: 400 });

  webpush.setVapidDetails('mailto:shopping-list@example.com', pub, priv);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data } = await sb.rpc('sl_push_targets', { p_list: list, p_except: by || '' });
  const payload = JSON.stringify({
    title: String(title || 'רשימת קניות').slice(0, 80),
    body: String(text || '').slice(0, 200),
    url: `/l/${list}`,
    tag: `sl-${list}`,
  });
  let sent = 0;
  await Promise.all((data || []).map(async (t) => {
    try { await webpush.sendNotification(t.sub, payload, { TTL: 3600 }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb.rpc('sl_push_delete', { p_endpoint: t.endpoint }); }
  }));
  return Response.json({ sent });
}
