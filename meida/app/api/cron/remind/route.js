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
  for (const p of data || []) {
    const d = await sendAll(p.targets, {
      title: `⏰ תזכורת: ${p.title || KIND_LABEL[p.kind] || ''}`.trim(), body: p.body || (p.author_name ? `מ${p.author_name}` : ''),
      tag: 'remind-' + p.id, url: `/s/${p.shop_id}?board=1`,
    });
    sent += p.targets.length - d.length; dead.push(...d);
  }
  if (dead.length) await sb.rpc('kb_cron_drop', { p_secret: secret, p_endpoints: dead });
  return Response.json({ due: (data || []).length, sent });
}
export const GET = run;
export const POST = run;
