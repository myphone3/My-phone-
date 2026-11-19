// תזכורות: נקרא כל 5 דקות (pg_cron ב-Supabase) עם סוד. שולח התראה על כל תזכורת שהגיע זמנה.
import { createClient } from '@supabase/supabase-js';
import { sendAll, KIND_LABEL } from '@/lib/webpush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function run(req) {
  const secret = req.headers.get('x-cron-secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('kb_cron_due', { p_secret: secret });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  const dead = [];
  // תזכורות לא נשלחות למי שבחר "רק שאלות" (הודעה דחופה כן)
  const q = (data || []).some((p) => p.kind !== 'urgent') ? await sb.rpc('kb_cron_quiet', { p_secret: secret }) : { data: [] };
  const quiet = new Set(q.data || []);
  for (const p of data || []) {
    if (p.kind !== 'urgent') p.targets = (p.targets || []).filter((t) => !quiet.has(t.endpoint));
    if (!p.targets.length) continue;
    const d = await sendAll(p.targets, {
      title: p.label || `⏰ תזכורת: ${p.title || KIND_LABEL[p.kind] || ''}`.trim(), body: p.body || (p.author_name ? `מ${p.author_name}` : ''),
      tag: (p.kind === 'urgent' ? 'post-' : 'remind-') + p.id, url: p.url || `/s/${p.shop_id}?board=1`, icon: `/api/icon/${p.shop_id}?s=192`, urgent: p.kind === 'urgent',
    });
    sent += p.targets.length - d.length; dead.push(...d);
  }
  if (dead.length) await sb.rpc('kb_cron_drop', { p_secret: secret, p_endpoints: dead });
  return Response.json({ due: (data || []).length, sent });
}
export const GET = run;
export const POST = run;
