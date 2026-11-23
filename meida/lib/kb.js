// סוגי מידע, שדות, חיפוש ועזרים
export const TYPES = [
  { k: 'note', label: 'מידע כללי', e: '📝', fields: ['model'] },
  { k: 'warranty', label: 'תנאי אחריות', e: '🛡️', fields: [] },
  { k: 'compare', label: 'השוואה / פרטים', e: '📊', fields: ['pc', 'mobile', 'cost'] },
  { k: 'code', label: 'קוד / סיסמה', e: '🔑', fields: ['code', 'user'] },
  { k: 'imei', label: 'IMEI / מכשיר', e: '🔢', fields: ['imei', 'model', 'serial'] },
  { k: 'service', label: 'נקודת שירות', e: '📍', fields: ['address', 'city', 'phone', 'hours'] },
  { k: 'contact', label: 'טלפון / איש קשר', e: '☎️', fields: ['person', 'phone', 'phone2'] },
  { k: 'howto', label: 'הוראות / איך עושים', e: '📋', fields: ['model'] },
  { k: 'price', label: 'מחיר / מבצע', e: '🏷️', fields: ['price', 'until'] },
  { k: 'link', label: 'קישור / אתר', e: '🔗', fields: ['url'] },
];
export const typeOf = (k, shop) => {
  const t = TYPES.find((x) => x.k === k) || TYPES[0];
  const o = shop?.settings?.types?.[t.k];
  return o ? { ...t, label: o.label || t.label, e: o.e || t.e } : t;
};
// סוגי המידע של החנות: עם השמות שהמנהל שינה, בסדר שלו, בלי המוסתרים
export function shopTypes(shop) {
  const o = shop?.settings?.types || {};
  const order = shop?.settings?.typeOrder || [];
  const pos = (k) => { const i = order.indexOf(k); return i < 0 ? 100 + TYPES.findIndex((t) => t.k === k) : i; };
  return TYPES.map((t) => typeOf(t.k, shop)).filter((t) => !o[t.k]?.hidden).sort((a, b) => pos(a.k) - pos(b.k));
}

// ===== מלאי =====
export const STOCK_ST = [
  { k: 'out', label: 'נגמר', e: '🔴', cls: 'p-out' },
  { k: 'low', label: 'נשאר מעט', e: '🟡', cls: 'p-low' },
  { k: 'ordered', label: 'הוזמן', e: '🔵', cls: 'p-ord' },
  { k: 'arrived', label: 'הגיע', e: '🟢', cls: 'p-in' },
];
export const stockSt = (k, shop) => {
  const s = STOCK_ST.find((x) => x.k === k) || STOCK_ST[0];
  const o = shop?.settings?.status?.[s.k];
  return o ? { ...s, label: o.label || s.label, e: o.e || s.e } : s;
};

// ===== פתקים, שאלות =====
export const NOTE_KINDS = [
  { k: 'check', label: 'לבדוק / לא לשכוח', e: '📝' },
  { k: 'call', label: 'לחזור ללקוח', e: '📞' },
  { k: 'want', label: 'לקוח ביקש מוצר', e: '🛒' },
];
export const noteKind = (k) => NOTE_KINDS.find((x) => x.k === k) || NOTE_KINDS[0];
export const NOTE_ST = { waiting: { label: 'מחכה', cls: 'p-low' }, doing: { label: 'בטיפול', cls: 'p-ord' }, done: { label: 'טופל', cls: 'p-in' } };
export const ASK_KINDS = [
  { k: 'price', label: 'מחיר', e: '💰' },
  { k: 'stock', label: 'יש לנו?', e: '📦' },
  { k: 'general', label: 'שאלה', e: '❓' },
];
export const askKind = (k) => ASK_KINDS.find((x) => x.k === k) || ASK_KINDS[0];

// ===== חברות וקטגוריות =====
const HUES = ['#1d4ed8', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf', '#c2410c'];
export const hueOf = (n) => HUES[[...String(n || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
export const live = (tags, kind) => tags.filter((t) => t.kind === kind && !t.deleted_at).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'he'));
export const catOf = (it, tagsById) => (it.tag_ids || []).map((id) => tagsById[id]).find((t) => t?.kind === 'category' && !t.deleted_at);
export const coOf = (it, tagsById) => (it.tag_ids || []).map((id) => tagsById[id]).find((t) => t?.kind === 'company' && !t.deleted_at);

// מידע עם כותרת דומה (כדי לא להוסיף כפול)
export function similarItems(items, title, exceptId) {
  const a = norm(title);
  if (a.length < 3) return [];
  const aw = a.split(' ').filter((w) => w.length >= 3);
  return items.filter((x) => {
    if (x.id === exceptId || x.deleted_at) return false;
    const b = norm(x.title);
    if (!b) return false;
    if (b.length >= 3 && (b.includes(a) || a.includes(b))) return true;
    const bw = b.split(' ').filter((w) => w.length >= 3);
    const common = aw.filter((w) => bw.some((y) => y.includes(w) || w.includes(y))).length;
    return common >= 2 || (aw.length === 1 && common === 1 && aw[0].length >= 5);
  }).slice(0, 4);
}

// תאריכים
export const today = () => new Date().toLocaleDateString('en-CA');
export function untilPreset(k) {
  const d = new Date();
  if (k === 'week') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  if (k === 'month') { d.setMonth(d.getMonth() + 1, 0); }
  return d.toLocaleDateString('en-CA');
}
export function untilLabel(until) {
  if (!until) return 'בלי תאריך';
  if (until === today()) return 'רק היום';
  const d = new Date(until + 'T12:00');
  return 'עד ' + d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}
export const fmtWhen = (iso) => new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
export const ils = (n) => (n === null || n === undefined || n === '' ? '' : `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`);
export const waHref = (text, phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  return 'https://wa.me/' + (p.length >= 9 ? p : '') + '?text=' + encodeURIComponent(text);
};

export const FIELDS = {
  code: { label: 'קוד', copy: true, mono: true },
  user: { label: 'שם משתמש', copy: true },
  imei: { label: 'IMEI', copy: true, mono: true, inputMode: 'numeric' },
  model: { label: 'דגם / מכשיר' },
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
  pc: { label: 'מחשב' },
  mobile: { label: 'טלפון (מכשיר)' },
  cost: { label: 'עלות' },
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
  const files = (it.files || []).map((x) => x.name).join(' ');
  const text = norm(`${it.title} ${tagNames} ${f} ${it.body} ${files} ${typeOf(it.type).label}`);
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
  for (const x of it.files || []) lines.push(`${fileKind(x).e} ${x.name || fileKind(x).label}: ${x.kind === 'file' ? downloadHref(x) : x.url}`);
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

// לוגו אוטומטי לחברה: לפי האתר שלה. חברות מוכרות — האתר כבר ידוע.
const DOMAINS = {
  samsung: 'samsung.com', 'סמסונג': 'samsung.com', apple: 'apple.com', 'אפל': 'apple.com', xiaomi: 'mi.com', 'שיאומי': 'mi.com',
  google: 'google.com', 'גוגל': 'google.com', motorola: 'motorola.com', 'מוטורולה': 'motorola.com', nokia: 'nokia.com', 'נוקיה': 'nokia.com',
  oneplus: 'oneplus.com', huawei: 'huawei.com', 'וואווי': 'huawei.com', oppo: 'oppo.com', honor: 'honor.com', realme: 'realme.com', zte: 'zte.com.cn',
  anker: 'anker.com', 'אנקר': 'anker.com', jbl: 'jbl.com', baseus: 'baseus.com', ugreen: 'ugreen.com', belkin: 'belkin.com', spigen: 'spigen.com', otterbox: 'otterbox.com',
  sony: 'sony.com', lg: 'lg.com', lenovo: 'lenovo.com', tcl: 'tcl.com', cat: 'catphones.com', 'קיוסרה': 'kyocera.com', kyocera: 'kyocera.com',
  'פרטנר': 'partner.co.il', partner: 'partner.co.il', 'סלקום': 'cellcom.co.il', cellcom: 'cellcom.co.il', 'פלאפון': 'pelephone.co.il', pelephone: 'pelephone.co.il',
  'הוט מובייל': 'hotmobile.co.il', 'הוט': 'hotmobile.co.il', 'גולן טלקום': 'golantelecom.co.il', 'גולן': 'golantelecom.co.il', 'רמי לוי': 'rl-mobile.co.il',
  'וי קום': 'we-com.co.il', '019': '019mobile.co.il', '012': '012mobile.co.il', 'בזק': 'bezeq.co.il', 'yes': 'yes.co.il',
  'נטפרי': 'netfree.link', netfree: 'netfree.link', 'רימון': 'rimon.net.il', 'נטספארק': 'netspark.com', netspark: 'netspark.com', 'אתרוג': 'etrog.net.il',
  'כושר פליי': 'kosherplay.co.il', 'קושר פליי': 'kosherplay.co.il', 'מובייל פליי': 'kosherplay.co.il', whatsapp: 'whatsapp.com', 'וואטסאפ': 'whatsapp.com',
};
export function guessDomain(name) {
  const n = String(name || '').trim().toLowerCase();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(n)) return n;
  return DOMAINS[n] || DOMAINS[n.split(' ')[0]] || '';
}
export const cleanDomain = (d) => String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

// ===== קבצים מצורפים =====
export const isApk = (x) => /\.apk(\?|$)/i.test(x?.url || '') || /android\.package/.test(x?.mime || '');
export function fileKind(x) {
  if (x.kind === 'video') return { e: '🎬', label: 'סרטון', cls: 'vid' };
  if (x.kind === 'link') return { e: '🔗', label: 'קישור', cls: 'lnk' };
  if (isApk(x)) return { e: '📱', label: 'אפליקציה', cls: 'apk' };
  if (/pdf/i.test(x.mime || '') || /\.pdf(\?|$)/i.test(x.url)) return { e: '📄', label: 'PDF', cls: 'doc' };
  if (/^image\//.test(x.mime || '')) return { e: '🖼️', label: 'תמונה', cls: 'doc' };
  return { e: '📎', label: 'קובץ', cls: 'doc' };
}
export const isOwnVideo = (u) => /\/kb-videos\/|\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(u || '');
export const fmtSize = (n) => (!n ? '' : n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB');
// קישור הורדה ששומר את שם הקובץ (Supabase: ?download=שם)
export function downloadHref(x) {
  if (!/\/storage\/v1\/object\/public\//.test(x.url)) return x.url;
  const ext = (x.url.match(/\.([a-z0-9]{1,8})$/i) || [])[1];
  let name = String(x.name || '').trim() || 'file';
  if (ext && !name.toLowerCase().endsWith('.' + ext.toLowerCase())) name += '.' + ext;
  return x.url + '?download=' + encodeURIComponent(name);
}
