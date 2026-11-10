// כלים ל-SEO שרצים בשרת: כתובת האתר, קריאה מ-Supabase (עם מטמון) ונתונים מובנים לגוגל.
import { BUSINESS } from './business';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://my-phone-iota.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'NEW PHONE';

// קריאה מטבלה ב-Supabase דרך REST. אם בסיס הנתונים לא עונה תוך 4 שניות, מחזירים רשימה ריקה.
export async function restSelect<T = any>(query: string, revalidate = 600): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// התמונה הראשית של מוצר (image_url, או הראשונה מתוך images)
export function firstImage(p: any): string {
  if (typeof p?.image_url === 'string' && p.image_url.trim()) return p.image_url.trim();
  let imgs = p?.images;
  if (typeof imgs === 'string') {
    try {
      imgs = JSON.parse(imgs);
    } catch {
      return imgs;
    }
  }
  if (Array.isArray(imgs) && typeof imgs[0] === 'string') return imgs[0];
  return '';
}

// טקסט נקי לתיאור (בלי סימני Markdown), באורך שמתאים לגוגל
export function plainText(s: unknown, max = 160): string {
  const t = String(s || '')
    .replace(/[#*_>`\[\]()|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// המחיר שהלקוח משלם בפועל: מחיר מבצע רק אם הוא באמת נמוך מהמחיר הרגיל
export function effectivePrice(p: any): number {
  const price = Number(p?.price) || 0;
  const sale = Number(p?.sale_price) || 0;
  return sale > 0 && sale < price ? sale : price;
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/Logo.JPG`,
    image: `${SITE_URL}/Logo.JPG`,
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    ...(BUSINESS.address ? { address: BUSINESS.address } : {}),
    sameAs: [`https://wa.me/${BUSINESS.whatsapp}`],
  };
}

// JSON בתוך תגית script: מונעים סגירה מוקדמת של התגית
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
