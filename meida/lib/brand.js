// שם ולוגו של חנות (בשרת, בלי משתמש מחובר) — בשביל האייקון וקובץ ההתקנה של כל חנות
export const SHOP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function getBrand(id) {
  if (!SHOP_ID.test(id || '')) return null;
  try {
    const r = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/kb_shop_brand', {
      method: 'POST',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_shop: id }),
      next: { revalidate: 60 },
    });
    if (!r.ok) return null;
    const b = await r.json();
    return b && b.name ? { name: b.name, logo: b.logo_url || '' } : null;
  } catch { return null; }
}

// גרסה של האייקון: משתנה רק כשהלוגו מתחלף (ככה הטלפון יודע לעדכן את האייקון)
export function iconVersion(logo) {
  let h = 0;
  for (const c of logo || 'none') h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

export function iconUrl(id, logo, size, mask) {
  return `/api/icon/${id}?s=${size}${mask ? '&m=1' : ''}&v=${iconVersion(logo)}`;
}

// שם קצר מתחת לאייקון
export function appName(name) {
  return { name: `מידע · ${name}`, short: `מידע ${name}`.slice(0, 20) };
}
