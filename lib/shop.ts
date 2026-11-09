import { supabase } from './supabase';
import { BUSINESS } from './business';
import { track } from './track';

// כלים משותפים לחנות: השוואה, תאריך הגעה משוער ותגיות למוצרים.

const read = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const write = (key: string, list: string[], event: string) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // אחסון חסום
  }
  window.dispatchEvent(new Event(event));
};

// ===== השוואה ⚖️ (עד 3 מוצרים) =====
const CMP_KEY = 'np_compare';
export const COMPARE_EVENT = 'compareUpdated';
export const COMPARE_MAX = 3;
export const getCompare = () => read(CMP_KEY);
export const inCompare = (id: string) => getCompare().includes(String(id));
// מחזיר 'added' / 'removed' / 'full'
export function toggleCompare(id: string): 'added' | 'removed' | 'full' {
  const list = getCompare();
  if (list.includes(String(id))) {
    write(CMP_KEY, list.filter((x) => x !== String(id)), COMPARE_EVENT);
    return 'removed';
  }
  if (list.length >= COMPARE_MAX) return 'full';
  write(CMP_KEY, [...list, String(id)], COMPARE_EVENT);
  track('compare', { product_id: String(id) });
  return 'added';
}
export const clearCompare = () => write(CMP_KEY, [], COMPARE_EVENT);
export const removeFromCompare = (id: string) => write(CMP_KEY, getCompare().filter((x) => x !== String(id)), COMPARE_EVENT);

// ===== תאריך הגעה משוער 🚚 =====
// ימי עסקים: ראשון עד חמישי (בלי שישי ושבת). הזמנה אחרי שעת הסגירה, או בשישי/שבת, נספרת מיום העסקים הבא.
// חגים לא נלקחים בחשבון, ולכן זה "משוער".
const isBusinessDay = (d: Date) => d.getDay() >= 0 && d.getDay() <= 4;

function israelNow() {
  // השעה בישראל, גם כשהלקוח נמצא באזור זמן אחר
  const s = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
  return new Date(s);
}

function addBusinessDays(from: Date, days: number) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) left--;
  }
  return d;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const fmt = (d: Date) => `יום ${DAY_NAMES[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;

export function deliveryEstimate() {
  const now = israelNow();
  // הזמנה ביום עסקים לפני שעת הסגירה נכנסת היום; אחרת ביום העסקים הבא
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!isBusinessDay(now) || now.getHours() >= BUSINESS.sameDayCutoffHour) {
    do start.setDate(start.getDate() + 1);
    while (!isBusinessDay(start));
  }
  const from = addBusinessDays(start, BUSINESS.shippingMinDays);
  const to = addBusinessDays(start, BUSINESS.shippingMaxDays);

  // כמה זמן נשאר להזמין היום (רק ביום עסקים לפני שעת הסגירה)
  let cutoffLeft = '';
  if (isBusinessDay(now) && now.getHours() < BUSINESS.sameDayCutoffHour) {
    const mins = (BUSINESS.sameDayCutoffHour - now.getHours()) * 60 - now.getMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    cutoffLeft = h > 0 ? `${h} שע׳ ו-${m} דק׳` : `${m} דק׳`;
  }
  return { from, to, fromText: fmt(from), toText: fmt(to), cutoffLeft };
}

// ===== תגיות למוצר =====
let bestSellersPromise: Promise<Set<string>> | null = null;
export function getBestSellers(): Promise<Set<string>> {
  if (!bestSellersPromise) {
    bestSellersPromise = (async () => {
      try {
        const { data } = await supabase.rpc('best_sellers', { p_days: 30, p_limit: 6 });
        return new Set(((data as any[]) || []).map((r) => String(r.product_id ?? r)));
      } catch {
        return new Set<string>();
      }
    })();
  }
  return bestSellersPromise;
}

export type Badge = { label: string; className: string };

// כל התגיות מבוססות על נתונים אמיתיים: מכירות ב-30 הימים האחרונים, מלאי ותאריך הוספה
export function productBadges(p: any, bestSellers?: Set<string>): Badge[] {
  const badges: Badge[] = [];
  const stock = p?.stock === null || p?.stock === undefined || p?.stock === '' ? null : Number(p.stock);
  if (bestSellers?.has(String(p?.id))) badges.push({ label: '🔥 הכי נמכר', className: 'bg-orange-600 text-white' });
  const created = p?.created_at ? new Date(p.created_at).getTime() : 0;
  if (created && Date.now() - created < 21 * 86400000) badges.push({ label: '✨ חדש', className: 'bg-blue-600 text-white' });
  if (stock !== null && !isNaN(stock)) {
    if (stock <= 0) badges.push({ label: 'אזל מהמלאי', className: 'bg-gray-700 text-white' });
    else if (stock <= 3) badges.push({ label: `נשארו ${stock} בלבד`, className: 'bg-amber-400 text-amber-950' });
  }
  return badges;
}

// קישור לוואטסאפ עם שאלה על מוצר מסוים
export function whatsappAboutProduct(name: string, url: string) {
  const text = `שלום, יש לי שאלה על המוצר: ${name}\n${url}`;
  return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(text)}`;
}
