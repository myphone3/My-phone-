import { supabase } from './supabase';

// טעינה מראש: כשאצבע נוגעת בכרטיס מוצר (או העכבר עובר עליו), מתחילים כבר להביא את פרטי המוצר,
// כך שעמוד המוצר נפתח כמעט מיד. התוצאה נשמרת לדקה.
type Res = { data: any; error: any };
const TTL = 60_000;
const products = new Map<string, { at: number; promise: Promise<Res> }>();
let brands: Promise<Res> | null = null;
let kosher: Promise<Res> | null = null;

const run = (q: PromiseLike<Res>): Promise<Res> => Promise.resolve(q).then((r) => r, (error) => ({ data: null, error }));

export function getProduct(id: string): Promise<Res> {
  const hit = products.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = run(supabase.from('products').select('*').eq('id', id).single());
  products.set(id, { at: Date.now(), promise });
  promise.then((r) => {
    if (r.error) products.delete(id); // שגיאה לא נשמרת
  });
  return promise;
}

export function getBrands(): Promise<Res> {
  if (!brands) {
    brands = run(supabase.from('brands').select('*'));
    brands.then((r) => r.error && (brands = null));
  }
  return brands;
}

export function getKosherOptions(): Promise<Res> {
  if (!kosher) {
    kosher = run(supabase.from('kosher_options').select('*'));
    kosher.then((r) => r.error && (kosher = null));
  }
  return kosher;
}

export function prefetchProduct(id: string) {
  getProduct(id);
  getBrands();
  getKosherOptions();
}
