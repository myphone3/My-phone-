import { versionName } from '@/lib/versionPrice';

// סינון חכם: הסינונים נבנים מהמוצרים עצמם.
// סינון מוצג רק אם הוא באמת מחלק את המוצרים (למשל: אין "כשרות" במעמדים לרכב,
// ואין "גרסה" במטענים). כך כל קטגוריה מקבלת רק את מה שרלוונטי לה.

export type FacetState = {
  brands: string[];
  kosher: string;
  version: string;
  price: string; // 'min-max'
  sale: boolean;
};

export const EMPTY_FACETS: FacetState = { brands: [], kosher: '', version: '', price: '', sale: false };

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const v = JSON.parse(val);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;
export const onSale = (p: any) => !!(p.sale_price && Number(p.sale_price) > 0 && Number(p.sale_price) < Number(p.price));
const brandOf = (p: any) => String(p.brand || '').trim();
const kosherOf = (p: any) => String(p.kosher || '').trim();
const versionsOf = (p: any) =>
  asArray(p.product_variants || p.versions || p.product_versions || p.variants)
    .map(versionName)
    .map((v: string) => String(v || '').trim())
    .filter(Boolean);

export type Option = { value: string; label: string; count: number };

// ערכים + כמה מוצרים בכל ערך. מחזיר [] אם הסינון לא מחלק את המוצרים
function options(products: any[], valuesOf: (p: any) => string[]): Option[] {
  const count = new Map<string, number>();
  let withAny = 0;
  for (const p of products) {
    const vals = Array.from(new Set(valuesOf(p)));
    if (vals.length) withAny++;
    vals.forEach((v) => count.set(v, (count.get(v) || 0) + 1));
  }
  const list = Array.from(count.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => ({ value, label: value, count: n }));
  // ערך אחד שקיים בכל המוצרים לא עוזר לסנן
  if (list.length === 0 || (list.length === 1 && withAny === products.length)) return [];
  return list;
}

const roundNice = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 50) * 50);
const shekel = (n: number) => `₪${n.toLocaleString('he-IL')}`;

// טווחי מחיר לפי המחירים האמיתיים (עד 4 טווחים בערך שווים)
export function priceRanges(products: any[]): Option[] {
  const prices = products.map(priceOf).filter((x) => x > 0).sort((a, b) => a - b);
  if (prices.length < 4) return [];
  const lo = prices[0];
  const hi = prices[prices.length - 1];
  if (hi < lo * 1.3) return [];
  const parts = prices.length >= 12 ? 4 : 3;
  const edges = Array.from(new Set(Array.from({ length: parts - 1 }, (_, i) => roundNice(prices[Math.floor((prices.length * (i + 1)) / parts)]))))
    .filter((e) => e > lo && e < hi)
    .sort((a, b) => a - b);
  if (!edges.length) return [];
  const bounds = [0, ...edges, 9999999];
  return bounds.slice(0, -1).map((from, i) => {
    const to = bounds[i + 1];
    const value = `${from}-${to}`;
    const label = i === 0 ? `עד ${shekel(to)}` : to === 9999999 ? `מעל ${shekel(from)}` : `${shekel(from)} – ${shekel(to)}`;
    return { value, label, count: prices.filter((x) => x > from && x <= to).length + (i === 0 ? prices.filter((x) => x === 0).length : 0) };
  });
}

export function buildFacets(products: any[]) {
  const sales = products.filter(onSale).length;
  return {
    brands: options(products, (p) => (brandOf(p) ? [brandOf(p)] : [])),
    kosher: options(products, (p) => (kosherOf(p) ? [kosherOf(p)] : [])),
    versions: options(products, versionsOf),
    prices: priceRanges(products),
    sale: sales > 0 && sales < products.length ? sales : 0,
  };
}

export function applyFacets(products: any[], f: FacetState) {
  return products.filter((p) => {
    if (f.brands.length && !f.brands.some((b) => b.toLowerCase() === brandOf(p).toLowerCase())) return false;
    if (f.kosher && kosherOf(p) !== f.kosher) return false;
    if (f.version && !versionsOf(p).includes(f.version)) return false;
    if (f.sale && !onSale(p)) return false;
    if (f.price) {
      const [from, to] = f.price.split('-').map(Number);
      const x = priceOf(p);
      if (!(x > from && x <= to) && !(from === 0 && x === 0)) return false;
    }
    return true;
  });
}

export const activeCount = (f: FacetState) => f.brands.length + (f.kosher ? 1 : 0) + (f.version ? 1 : 0) + (f.price ? 1 : 0) + (f.sale ? 1 : 0);
