// התראות שעובד שולח: הודעה חדשה (לכולם), בירור מחיר חדש (לכולם), תשובה על בירור מחיר (למי ששאל)
import { createClient } from '@supabase/supabase-js';
import { sendAll, KIND_LABEL } from '@/lib/webpush';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f-]{36}$/;
const ils = (n) => (n === null || n === undefined ? '' : `₪${Number(n).toLocaleString('he-IL')}`);

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { shop, post, ask, answer } = await req.json().catch(() => ({}));
  if (!token || !UUID.test(shop || '') || !(UUID.test(post || '') || UUID.test(ask || ''))) return Response.json({ error: 'bad' }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false },
  });
  let targets, payload;
  const { data: load } = await sb.rpc('kb_load', { p_shop: shop, p_since: new Date(Date.now() - 5 * 60000).toISOString() });
  if (post) {
    const r = await sb.rpc('kb_post_targets', { p_shop: shop, p_post: post });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    targets = r.data;
    const p = (load?.posts || []).find((x) => x.id === post);
    if (!p) return Response.json({ sent: 0 });
    payload = { title: `${KIND_LABEL[p.kind] || 'הודעה'} מ${p.author_name || 'החנות'}`, body: (p.title || p.body || '').slice(0, 160), tag: 'post-' + p.id, url: `/s/${shop}?board=1` };
  } else {
    const r = await sb.rpc('kb_ask_targets', { p_shop: shop, p_ask: ask, p_answer: UUID.test(answer || '') ? answer : null });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    targets = r.data;
    const a = (load?.asks || []).find((x) => x.id === ask);
    if (!a) return Response.json({ sent: 0 });
    if (answer) {
      const x = (a.answers || []).find((y) => y.id === answer);
      payload = { title: `💰 ${x?.by_name || 'עובד'} ענה: ${ils(x?.price)}`.trim(), body: `${a.product || 'בירור מחיר'}${x?.note ? ' — ' + x.note : ''}`.slice(0, 160), tag: 'ask-' + a.id, url: `/s/${shop}?asks=1` };
    } else {
      payload = { title: `💰 בירור מחיר מ${a.asked_by_name || 'עובד'}`, body: (a.product || a.note || 'מה המחיר?').slice(0, 160), tag: 'ask-' + a.id, url: `/s/${shop}?asks=1` };
    }
  }
  if (!targets?.length) return Response.json({ sent: 0 });
  const dead = await sendAll(targets, payload);
  if (dead.length) await sb.rpc('kb_push_drop', { p_endpoints: dead });
  return Response.json({ sent: targets.length - dead.length });
}
