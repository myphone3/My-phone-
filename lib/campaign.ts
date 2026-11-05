import { supabase } from './supabase';

// קישורי פרסום: מי שנכנס עם ?ref=קוד נרשם לקמפיין, והזמנה שלו בתוך 30 יום משויכת אליו (הקמפיין האחרון שנכנס ממנו).
// שומרים כמה קודים אחרונים: קוד שגוי בכתובת לא מוחק קוד תקין קודם, כי בזמן ההזמנה בסיס הנתונים מקבל רק קוד שקיים.
const STORAGE_KEY = 'np_ref';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[a-z0-9_-]{1,40}$/i;
const MAX_SAVED = 5;

type Saved = { code: string; at: number };

function savedCampaigns(): Saved[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.filter((s) => s?.code && CODE_RE.test(s.code) && Date.now() - Number(s.at) < WINDOW_MS);
  } catch {
    return [];
  }
}

export function captureCampaignFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (!code || !CODE_RE.test(code)) return;
    const lower = code.toLowerCase();
    const list = [{ code: lower, at: Date.now() }, ...savedCampaigns().filter((s) => s.code !== lower)].slice(0, MAX_SAVED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // כניסה נספרת פעם אחת לכל קמפיין בכל ביקור (סשן)
    const seenKey = `np_ref_seen_${code}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, '1');
    supabase.rpc('track_campaign_visit', { p_code: code }).then(() => undefined, () => undefined);
  } catch {
    // אחסון חסום בדפדפן: פשוט לא סופרים
  }
}

// משייך הזמנה שנוצרה עכשיו לקמפיין (בסיס הנתונים מוודא שזו ההזמנה של הלקוח הזה ושהקוד קיים)
export async function attachCampaignToOrder(orderId: string, token: string) {
  // מהחדש לישן: בסיס הנתונים משייך רק קוד שקיים ורק פעם אחת, כך שהקוד התקין האחרון הוא שנקבע
  // אם בקשה נכשלה (למשל בעיית רשת) עוצרים, כדי שקמפיין ישן יותר לא יקבל את ההזמנה במקום החדש
  for (const { code } of savedCampaigns()) {
    try {
      const { error } = await supabase.rpc('attach_order_ref', { p_id: orderId, p_token: token, p_ref: code });
      if (error) return;
    } catch {
      return; // השיוך הוא תוספת; ההזמנה עצמה כבר נשמרה
    }
  }
}
