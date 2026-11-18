// כל הפניות לשרת (פונקציות kb_* ב-Supabase)
import { supabase } from './supabase';

const ERR = {
  signin: 'צריך להתחבר', 'not-member': 'אין לך גישה לחנות הזו (אולי עוד לא אישרו אותך)',
  'not-admin': 'רק מנהל יכול לעשות את זה', 'owner only': 'רק הבעלים יכול לעשות את זה',
};
export function errText(e) {
  const m = String(e?.message || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/fetch|network|Failed/i.test(m)) return 'אין חיבור לאינטרנט';
  return m || 'משהו השתבש';
}

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const api = {
  myShops: () => rpc('kb_my_shops'),
  createShop: (name, city, phone) => rpc('kb_create_shop2', { p_name: name, p_city: city || '', p_phone: phone || '' }),
  joinInfo: (code) => rpc('kb_join_info', { p_code: code }),
  join: (code) => rpc('kb_join', { p_code: code }),
  load: (shop, since) => rpc('kb_load', { p_shop: shop, p_since: since || null }),
  saveItem: (shop, item) => rpc('kb_save_item', { p_shop: shop, p_item: item }),
  saveItems: (shop, items) => rpc('kb_save_items', { p_shop: shop, p_items: items }),
  pin: (shop, id, pinned) => rpc('kb_pin_item', { p_shop: shop, p_id: id, p_pinned: pinned }),
  deleteItem: (shop, id) => rpc('kb_delete_item', { p_shop: shop, p_id: id }),
  deletedItems: (shop) => rpc('kb_deleted_items', { p_shop: shop }),
  restoreItem: (shop, id) => rpc('kb_restore_item', { p_shop: shop, p_id: id }),
  history: (shop, id) => rpc('kb_item_history', { p_shop: shop, p_id: id }),
  saveTag: (shop, tag) => rpc('kb_save_tag', { p_shop: shop, p_tag: tag }),
  deleteTag: (shop, id) => rpc('kb_delete_tag', { p_shop: shop, p_id: id }),
  members: (shop) => rpc('kb_members_list', { p_shop: shop }),
  setMember: (shop, user, action) => rpc('kb_set_member', { p_shop: shop, p_user: user, p_action: action }),
  leave: (shop) => rpc('kb_leave', { p_shop: shop }),
  savePost: (shop, post) => rpc('kb_save_post', { p_shop: shop, p: post }),
  postStatus: (shop, id, status) => rpc('kb_post_status', { p_shop: shop, p_id: id, p_status: status }),
  deletePost: (shop, id) => rpc('kb_delete_post', { p_shop: shop, p_id: id }),
  seenPosts: (shop) => rpc('kb_seen_posts', { p_shop: shop }),
  pushSave: (shop, s) => rpc('kb_push_save', { p_shop: shop, p_endpoint: s.endpoint, p_p256dh: s.keys.p256dh, p_auth: s.keys.auth }),
  pushOff: (shop, endpoint) => rpc('kb_push_off', { p_shop: shop, p_endpoint: endpoint || null }),
  miss: (shop, q) => rpc('kb_miss', { p_shop: shop, p_query: q }),
  misses: (shop) => rpc('kb_misses_list', { p_shop: shop }),
  missSet: (shop, id, status) => rpc('kb_miss_set', { p_shop: shop, p_id: id, p_status: status }),
  setLogo: (shop, url) => rpc('kb_set_logo', { p_shop: shop, p_url: url || '' }),
  ask: (shop, a) => rpc('kb_ask', { p_shop: shop, p: a }),
  answer: (shop, ask, price, note) => rpc('kb_answer', { p_shop: shop, p_ask: ask, p_price: price, p_note: note || '' }),
  askSet: (shop, ask, action) => rpc('kb_ask_set', { p_shop: shop, p_ask: ask, p_action: action }),
  updateShop: (shop, name, allowJoin, newCode) => rpc('kb_update_shop', { p_shop: shop, p_name: name, p_allow_join: allowJoin, p_new_code: !!newCode }),
};

// קריאה לשרת של האפליקציה (עם כרטיס הכניסה של המשתמש)
export async function serverCall(path, body) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

export async function ai(body) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error === 'no-ai' ? 'הסידור האוטומטי עוד לא מוגדר בשרת' : j.error || 'ה-AI לא הצליח');
  return j;
}

export async function uploadPhoto(blob) {
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('kb-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('kb-photos').getPublicUrl(path).data.publicUrl;
}
