// התראות שעובד שולח: הודעה חדשה, שאלה לצוות, תשובה, דיווח מלאי, פתק, תגובה, אישור הודעה דחופה
// מי שבחר "רק שאלות" (ברירת המחדל) מקבל רק שאלות, תשובות והודעות דחופות
import { createClient } from '@supabase/supabase-js';
import { sendAll, KIND_LABEL } from '@/lib/webpush';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f-]{36}$/;
const ils = (n) => (n === null || n === undefined ? '' : `₪${Number(n).toLocaleString('he-IL')}`);
const ASK = { price: '💰 בירור מחיר', stock: '📦 יש לנו?', general: '❓ שאלה' };
const NOTE = { check: '📝 פתק', call: '📞 לחזור ללקוח', want: '🛒 לקוח ביקש' };
const ST = { out: 'נגמר', low: 'נשאר מעט', ordered: 'הוזמן', arrived: 'הגיע' };

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const b = await req.json().catch(() => ({}));
  const { shop } = b;
  const ref = ['post', 'ask', 'stock', 'note', 'reply', 'ack', 'supply'].find((k) => UUID.test(b[k] || ''));
  if (!token || !UUID.test(shop || '') || !ref) return Response.json({ error: 'bad' }, { status: 400 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false },
  });
  if (ref === 'supply') {
    // מצרכי חנות (טישו, שתייה...) — נפרד מהמלאי
    const r = await sb.rpc('kb_supply_targets', { p_shop: shop, p_id: b.supply });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    let targets = r.data;
    if (!targets?.length) return Response.json({ sent: 0 });
    const q = await sb.rpc('kb_quiet_endpoints', { p_shop: shop });
    const quiet = new Set(q.data || []);
    targets = targets.filter((t) => !quiet.has(t.endpoint));
    if (!targets.length) return Response.json({ sent: 0 });
    const { data: list } = await sb.rpc('kb_supplies', { p_shop: shop });
    const x = (list || []).find((y) => y.id === b.supply);
    if (!x) return Response.json({ sent: 0 });
    const payload = { title: `🧻 ${x.status === 'out' ? 'נגמר' : 'עומד להיגמר'}: ${x.name}`, body: `${x.status_by_name || 'עובד'} · צריך לקנות`, tag: 'supply-' + x.id, url: `/s/${shop}?supplies=1`, icon: `/api/icon/${shop}?s=192` };
    const dead = await sendAll(targets, payload);
    if (dead.length) await sb.rpc('kb_push_drop', { p_endpoints: dead });
    return Response.json({ sent: targets.length - dead.length });
  }
  const { data: load } = await sb.rpc('kb_load', { p_shop: shop, p_since: new Date(Date.now() - 5 * 60000).toISOString() });
  const id = b[ref];
  let targets, payload;
  const url = (q) => `/s/${shop}?${q}=1`;

  if (ref === 'post') {
    const r = await sb.rpc('kb_post_targets', { p_shop: shop, p_post: id });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    targets = r.data;
    const p = (load?.posts || []).find((x) => x.id === id);
    if (!p) return Response.json({ sent: 0 });
    payload = { title: p.urgent ? `🚨 דחוף מ${p.author_name || 'החנות'}` : `${KIND_LABEL[p.kind] || '💬 הודעה'} מ${p.author_name || 'החנות'}`, body: (p.title || p.body || '').slice(0, 160), tag: 'post-' + p.id, url: url('board'), urgent: !!p.urgent };
  } else if (ref === 'ask') {
    const answer = UUID.test(b.answer || '') ? b.answer : null;
    const r = await sb.rpc('kb_ask_targets', { p_shop: shop, p_ask: id, p_answer: answer });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    targets = r.data;
    const a = (load?.asks || []).find((x) => x.id === id);
    if (!a) return Response.json({ sent: 0 });
    if (answer) {
      const x = (a.answers || []).find((y) => y.id === answer);
      payload = { title: `💬 ${x?.by_name || 'עובד'} ענה${x?.price !== null && x?.price !== undefined ? ': ' + ils(x.price) : ''}`, body: `${a.product || 'השאלה שלך'}${x?.note ? ' — ' + x.note : ''}`.slice(0, 160), tag: 'ask-' + a.id, url: url('asks') };
    } else {
      payload = { title: `${ASK[a.kind] || ASK.price} מ${a.asked_by_name || 'עובד'}`, body: (a.product || a.note || 'שאלה לצוות').slice(0, 160), tag: 'ask-' + a.id, url: url('asks') };
    }
  } else {
    const r = await sb.rpc('kb_new_targets', { p_shop: shop, p_ref: ref, p_id: id });
    if (r.error) return Response.json({ error: 'denied' }, { status: 403 });
    targets = r.data;
    if (ref === 'stock') {
      const x = (load?.stock || []).find((y) => y.id === id);
      if (!x) return Response.json({ sent: 0 });
      payload = { title: `${x.place === 'lab' ? '🔧 מעבדה' : '📦'} ${ST[x.status] || 'חסר'}: ${x.name}${x.qty ? ` — כמות: ${x.qty}` : ''}`, body: `דיווח של ${x.status_by_name || x.created_by_name || 'עובד'}${x.note ? ' · ' + x.note : ''}`, tag: 'stock-' + x.id, url: `/s/${shop}?stock=1&focus=${x.id}` };
      if (x.status !== 'arrived') {
        payload.actions = [{ action: 'arrived', title: '✓ הגיע' }];
        payload.acts = { arrived: `/s/${shop}?stock=1&arrived=${x.id}` };
      }
    } else if (ref === 'note') {
      const x = (load?.notes || []).find((y) => y.id === id);
      if (!x) return Response.json({ sent: 0 });
      payload = { title: `${NOTE[x.kind] || NOTE.check} מ${x.author_name || 'עובד'}`, body: [x.title, x.customer].filter(Boolean).join(' · ').slice(0, 160), tag: 'note-' + x.id, url: url('notes') };
    } else if (ref === 'reply') {
      const x = (load?.replies || []).find((y) => y.id === id);
      if (!x) return Response.json({ sent: 0 });
      payload = { title: `💬 ${x.by_name || 'עובד'} הגיב להודעה שלך`, body: x.body.slice(0, 160), tag: 'reply-' + x.post_id, url: url('board') };
    } else {
      const p = (load?.posts || []).find((y) => y.id === id) || {};
      const s = (load?.seen || []).filter((y) => y.ref === 'post' && y.ref_id === id).pop();
      payload = { title: `✓ ${s?.name || 'עובד'} ראה את ההודעה הדחופה`, body: (p.title || p.body || '').slice(0, 160), tag: 'ack-' + id, url: url('board') };
    }
  }
  // מי שבחר "רק שאלות ותשובות" מקבל רק שאלות, תשובות והודעות דחופות
  const important = ref === 'ask' || (ref === 'post' && payload?.urgent);
  if (!important && targets?.length) {
    const q = await sb.rpc('kb_quiet_endpoints', { p_shop: shop });
    const quiet = new Set(q.data || []);
    targets = targets.filter((t) => !quiet.has(t.endpoint));
  }
  if (!targets?.length) return Response.json({ sent: 0 });
  payload.icon = `/api/icon/${shop}?s=192`;
  const dead = await sendAll(targets, payload);
  if (dead.length) await sb.rpc('kb_push_drop', { p_endpoints: dead });
  return Response.json({ sent: targets.length - dead.length });
}
