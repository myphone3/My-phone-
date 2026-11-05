// הגדרות SEO ומעקב מהפאנל (טבלת settings, שורה 1), נקראות בשרת ומתרעננות כל 5 דקות.
// אם בסיס הנתונים לא עונה תוך 3 שניות, האתר ממשיך עם ברירות המחדל.
export type SiteSettings = {
  meta_title?: string | null;
  meta_description?: string | null;
  favicon_url?: string | null;
  google_analytics_id?: string | null;
  facebook_pixel_id?: string | null;
  google_site_verification?: string | null;
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  try {
    const res = await fetch(
      `${url}/rest/v1/settings?id=eq.1&select=meta_title,meta_description,favicon_url,google_analytics_id,facebook_pixel_id,google_site_verification`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return {};
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0]) || {};
  } catch {
    return {};
  }
}

// מזהים שעוברים לתוך סקריפט: רק תבנית תקינה, כדי שערך שגוי לא יוכל להזריק קוד
export const validGaId = (id?: string | null) => (id && /^(G|UA|AW)-[A-Z0-9-]{4,20}$/i.test(id.trim()) ? id.trim() : '');
export const validPixelId = (id?: string | null) => (id && /^\d{5,20}$/.test(id.trim()) ? id.trim() : '');
