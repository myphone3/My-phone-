// תוספת המחיר של גרסה: נשמרת במוצר בשדה version_prices לפי שם הגרסה
export function versionName(v: any): string {
  return typeof v === 'object' && v ? String(v.name || v.title || v.label || '') : String(v || '');
}

export function versionExtra(product: any, v: any): number {
  if (!v) return 0;
  if (typeof v === 'object' && Number(v.price_add || v.price) > 0) return Number(v.price_add || v.price);
  const n = Number(product?.version_prices?.[versionName(v)]);
  return n > 0 ? n : 0;
}
