// חישובי אחריות, תאריכים וחיפוש
export const PRESETS = [
  { m: 0, label: 'בלי' },
  { m: 3, label: '3 חודשים' },
  { m: 6, label: 'חצי שנה' },
  { m: 12, label: 'שנה' },
  { m: 24, label: 'שנתיים' },
  { m: 36, label: '3 שנים' },
  { m: 60, label: '5 שנים' },
];

export const CATEGORIES = [
  { k: 'מוצרי חשמל', e: '🔌' },
  { k: 'סלולר ומחשבים', e: '📱' },
  { k: 'טלוויזיה ושמע', e: '📺' },
  { k: 'מטבח', e: '🍳' },
  { k: 'ריהוט ובית', e: '🛋️' },
  { k: 'ביגוד והנעלה', e: '👟' },
  { k: 'כלי עבודה', e: '🛠️' },
  { k: 'ילדים וצעצועים', e: '🧸' },
  { k: 'רכב', e: '🚗' },
  { k: 'אחר', e: '🧾' },
];
export const catEmoji = (k) => (CATEGORIES.find((c) => c.k === k) || { e: '🧾' }).e;

export function monthsLabel(m) {
  if (m === null || m === undefined || m === '') return 'לא צוין';
  m = Number(m);
  if (m === 0) return 'בלי אחריות';
  const p = PRESETS.find((x) => x.m === m);
  if (p) return p.label;
  if (m % 12 === 0) return `${m / 12} שנים`;
  return `${m} חודשים`;
}

const parse = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayStr = () => { const d = new Date(); return iso(d); };
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function expiryDate(r) {
  const d = parse(r.purchase_date);
  if (!d || !r.warranty_months) return null;
  const e = new Date(d.getFullYear(), d.getMonth() + Number(r.warranty_months), d.getDate());
  // 31 בינואר + חודש => סוף פברואר
  if (e.getDate() !== d.getDate()) e.setDate(0);
  return e;
}

// סטטוס: active / soon / expired / none / unknown
export function status(r) {
  if (Number(r.warranty_months) === 0) return { k: 'none', label: 'בלי אחריות' };
  const e = expiryDate(r);
  if (!e) return { k: 'unknown', label: r.warranty_months ? 'חסר תאריך קנייה' : 'אחריות לא צוינה' };
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.round((e - t) / 86400000);
  if (days < 0) return { k: 'expired', label: 'האחריות הסתיימה', days, end: e };
  return { k: days <= 30 ? 'soon' : 'active', label: 'נשארו ' + left(days), days, end: e };
}

function left(days) {
  if (days === 0) return 'היום האחרון!';
  if (days < 45) return days === 1 ? 'יום אחד' : `${days} ימים`;
  const m = Math.round(days / 30.4);
  if (m < 12) return `${m} חודשים`;
  const y = Math.floor(m / 12), rm = m % 12;
  const ys = y === 1 ? 'שנה' : y === 2 ? 'שנתיים' : `${y} שנים`;
  return rm ? `${ys} ו-${rm} ח׳` : ys;
}

export const fmtDate = (s) => { const d = typeof s === 'string' ? parse(s) : s; return d ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : ''; };
export const fmtPrice = (p) => (p === null || p === undefined || p === '' ? '' : '₪' + Number(p).toLocaleString('he-IL', { maximumFractionDigits: 2 }));

// חיפוש: כל מילה צריכה להופיע באחד השדות (בלי תלות בגרש/מקף/רווחים)
const norm = (s) => String(s || '').toLowerCase().replace(/["'׳״\-_.]/g, '').replace(/\s+/g, ' ').trim();
export function matches(r, q) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm([r.product, r.store, r.category, r.notes, r.serial, ...(r.items || []), r.price, fmtDate(r.purchase_date), r.purchase_date?.slice(0, 4)].join(' '));
  return words.every((w) => hay.includes(w));
}
