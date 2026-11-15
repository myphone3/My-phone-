import { CATEGORIES, CAT_EMOJI } from './catalog';
import { fmtQty } from './parse';

export const DEFAULT_ORDER = CATEGORIES.map((c) => c.id);

export function currentStore(list) {
  if (!list?.store_id) return null;
  return (list.stores || []).find((s) => s.id === list.store_id) || null;
}

// סדר מחלקות: לפי הסניף שנבחר (אם יש), אחרת סדר ברירת המחדל
export function catOrderOf(list) {
  const st = currentStore(list);
  const order = st?.order?.length ? [...st.order, ...DEFAULT_ORDER.filter((c) => !st.order.includes(c))] : DEFAULT_ORDER;
  return Object.fromEntries(order.map((c, i) => [c, i]));
}

export const assigneeOf = (item, list) => item.assigned_to || list?.assignments?.[item.category] || null;

export const keyOf = (name) => (name || '').trim().toLowerCase();

// מחיר ליחידה (כדי להשוות גם כשקנו כמות אחרת)
export const unitPrice = (price, qty) => (price != null && Number(qty) > 0 ? Number(price) / Number(qty) : price != null ? Number(price) : null);

export const shekel = (n) => '₪' + (Math.round(Number(n) * 100) / 100).toString();

export function fmtDate(iso) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
}

export function listAsText(list, items, { onlyLeft = false, title } = {}) {
  const order = catOrderOf(list);
  const rows = items
    .filter((i) => (onlyLeft ? i.status !== 'found' : true))
    .sort((a, b) => (order[a.category] ?? 99) - (order[b.category] ?? 99));
  let out = `🛒 *${title || list?.name || 'רשימת קניות'}*\n`;
  let cat = '';
  for (const i of rows) {
    if (i.category !== cat) { cat = i.category; out += `\n*${CAT_EMOJI[cat] || ''} ${cat}*\n`; }
    const mark = { found: '✅', missing: '❌', partial: '🌓', check: '❓', need: '▫️' }[i.status];
    const q = i.qty !== 1 || i.unit ? ` ×${fmtQty(i.qty)}${i.unit ? ' ' + i.unit : ''}` : '';
    out += `${mark} ${i.name}${q}${i.note ? ` (${i.note})` : ''}\n`;
  }
  return out;
}

// חלוקה אוטומטית: המחלקות לפי סדר ההליכה בחנות נחתכות לרצפים בגודל דומה,
// כך שכל אחד מקבל אזור אחד בחנות ולא רץ מקצה לקצה
export function autoSplit(items, list, people) {
  const order = catOrderOf(list);
  const counts = {};
  for (const i of items) if (i.status !== 'found') counts[i.category] = (counts[i.category] || 0) + 1;
  const cats = Object.keys(counts).sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99));
  const total = cats.reduce((s, c) => s + counts[c], 0);
  const out = {};
  if (!people.length || !total) return out;
  let p = 0, acc = 0;
  for (const c of cats) {
    const target = (total * (p + 1)) / people.length;
    if (acc > 0 && acc + counts[c] / 2 > target && p < people.length - 1) p++;
    out[c] = people[p];
    acc += counts[c];
  }
  return out;
}
