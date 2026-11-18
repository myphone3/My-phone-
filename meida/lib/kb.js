// סוגי מידע, שדות, חיפוש ועזרים
export const TYPES = [
  { k: 'note', label: 'מידע כללי', e: '📝', fields: [] },
  { k: 'code', label: 'קוד / סיסמה', e: '🔑', fields: ['code', 'user'] },
  { k: 'imei', label: 'IMEI / מכשיר', e: '🔢', fields: ['imei', 'model', 'serial'] },
  { k: 'service', label: 'נקודת שירות', e: '📍', fields: ['address', 'city', 'phone', 'hours'] },
  { k: 'contact', label: 'טלפון / איש קשר', e: '☎️', fields: ['person', 'phone', 'phone2'] },
  { k: 'howto', label: 'הוראות / איך עושים', e: '📋', fields: [] },
  { k: 'price', label: 'מחיר / מבצע', e: '🏷️', fields: ['price', 'until'] },
  { k: 'link', label: 'קישור / אתר', e: '🔗', fields: ['url'] },
];
export const typeOf = (k) => TYPES.find((t) => t.k === k) || TYPES[0];

export const FIELDS = {
  code: { label: 'קוד', copy: true, mono: true },
  user: { label: 'שם משתמש', copy: true },
  imei: { label: 'IMEI', copy: true, mono: true, inputMode: 'numeric' },
  model: { label: 'דגם' },
  serial: { label: 'מספר סידורי', copy: true, mono: true },
  address: { label: 'כתובת', map: true },
  city: { label: 'עיר' },
  phone: { label: 'טלפון', tel: true, inputMode: 'tel' },
  phone2: { label: 'טלפון נוסף', tel: true, inputMode: 'tel' },
  person: { label: 'שם' },
  hours: { label: 'שעות פתיחה' },
  price: { label: 'מחיר' },
  until: { label: 'בתוקף עד' },
  url: { label: 'קישור', url: true, inputMode: 'url' },
};
export const ALL_FIELDS = Object.keys(FIELDS);

export const KINDS = [
  { k: 'company', label: 'חברות', one: 'חברה', e: '🏢' },
  { k: 'device', label: 'מכשירים', one: 'מכשיר', e: '📱' },
  { k: 'topic', label: 'נושאים', one: 'נושא', e: '🗂️' },
];

// ===== חיפוש =====
// מנרמל: אותיות קטנות, בלי ניקוד/גרשיים, אותיות סופיות → רגילות
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .replace(/["'`׳״]/g, '')
    .replace(/[-_/.,:;()[\]]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const digits = (s) => String(s || '').replace(/\D/g, '');

// טקסט החיפוש של פריט (נבנה פעם אחת)
export function indexItem(it, tagsById) {
  const tagNames = (it.tag_ids || []).map((id) => tagsById[id]?.name || '').join(' ');
  const f = Object.values(it.fields || {}).join(' ');
  const text = norm(`${it.title} ${tagNames} ${f} ${it.body} ${typeOf(it.type).label}`);
  return { text, title: norm(it.title), digits: digits(`${f} ${it.body}`) };
}

// ניקוד התאמה: כל המילים חייבות להופיע. כותרת שווה יותר.
export function score(ix, words, numQ) {
  let s = 0;
  for (const w of words) {
    if (ix.title.includes(w)) s += ix.title.startsWith(w) ? 6 : 4;
    else if (ix.text.includes(w)) s += 1;
    else if (w.length >= 3 && /^\d+$/.test(w) && ix.digits.includes(w)) s += 3;
    else return 0;
  }
  if (numQ && numQ.length >= 5 && ix.digits.includes(numQ)) s += 5;
  return s;
}
export const queryWords = (q) => norm(q).split(' ').filter(Boolean);

// ===== IMEI =====
export function luhnOk(n) {
  if (!/^\d{15}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = +n[i];
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
// ספרת הביקורת ל-14 ספרות
export function luhnDigit(n14) {
  for (let d = 0; d <= 9; d++) if (luhnOk(n14 + d)) return d;
  return null;
}
export function imeiInfo(q) {
  const n = digits(q);
  if (!/^[\d\s-]+$/.test(String(q).trim())) return null;
  if (n.length === 15) return { imei: n, ok: luhnOk(n), tac: n.slice(0, 8) };
  if (n.length === 14) return { imei: n + luhnDigit(n), ok: true, tac: n.slice(0, 8), fixed: true };
  return null;
}

// ===== תצוגה =====
export function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.round(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} שע׳`;
  if (s < 86400 * 7) { const d = Math.round(s / 86400); return d === 1 ? 'אתמול' : `לפני ${d} ימים`; }
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
}

export const telHref = (p) => 'tel:' + String(p).replace(/[^\d*#+]/g, '');
export const wazeHref = (addr) => 'https://waze.com/ul?navigate=yes&q=' + encodeURIComponent(addr);
export const mapsHref = (addr) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
export const urlHref = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u);

// מפרק טקסט לחלקים: רגיל / טלפון / קישור / מספר ארוך (להעתקה)
const TOKEN = /(https?:\/\/[^\s]+|www\.[^\s]+|\*\d{3,5}\b|\b0\d{1,2}-?\d{7}\b|\b0\d{1,2}-\d{3}-?\d{4}\b|\b1-?[78]00-?\d{2,3}-?\d{3,4}\b|\b\d{12,17}\b)/g;
export function tokens(text) {
  const out = [];
  let last = 0;
  String(text || '').replace(TOKEN, (m, _1, idx) => {
    if (idx > last) out.push({ t: 'text', v: text.slice(last, idx) });
    if (/^(https?:|www\.)/.test(m)) out.push({ t: 'url', v: m });
    else if (/^\d{12,17}$/.test(m)) out.push({ t: 'num', v: m });
    else out.push({ t: 'tel', v: m });
    last = idx + m.length;
    return m;
  });
  if (last < String(text || '').length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

export function itemToText(it, tagsById) {
  const t = typeOf(it.type);
  const lines = [`${t.e} *${it.title || t.label}*`];
  for (const k of ALL_FIELDS) if (it.fields?.[k]) lines.push(`${FIELDS[k].label}: ${it.fields[k]}`);
  if (it.body) lines.push(it.body);
  const tags = (it.tag_ids || []).map((id) => tagsById[id]?.name).filter(Boolean);
  if (tags.length) lines.push('', tags.map((x) => '#' + x.replace(/\s+/g, '_')).join(' '));
  return lines.join('\n');
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}
