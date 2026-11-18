// אחרי שעובד פרסם הודעה: שולחים התראה לכל העובדים שהפעילו התראות (חוץ ממנו)
import { createClient } from '@supabase/supabase-js';
import { sendAll, KIND_LABEL } from '@/lib/webpush';

export const runtime = 'nodejs';

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { shop, post } = await req.json().catch(() => ({}));
  if (!token || !/^[0-9a-f-]{36}$/.test(shop || '') || !/^[0-9a-f-]{36}$/.test(post || '')) return Response.json({ error: 'bad' }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false },
  });
  const { data: targets, error } = await sb.rpc('kb_post_targets', { p_shop: shop, p_post: post });
  if (error) return Response.json({ error: 'denied' }, { status: 403 });
  const { data: load } = await sb.rpc('kb_load', { p_shop: shop, p_since: new Date(Date.now() - 5 * 60000).toISOString() });
  const p = (load?.posts || []).find((x) => x.id === post);
  if (!p || !targets?.length) return Response.json({ sent: 0 });
  const dead = await sendAll(targets, {
    title: `${KIND_LABEL[p.kind] || 'הודעה'} מ${p.author_name || 'החנות'}`,
    body: (p.title || p.body || '').slice(0, 160), tag: 'post-' + p.id, url: `/s/${shop}?board=1`,
  });
  if (dead.length) await sb.rpc('kb_push_drop', { p_endpoints: dead });
  return Response.json({ sent: targets.length - dead.length });
}
