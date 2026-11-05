import { supabase } from './supabase';

// קישורי פרסום: מי שנכנס עם ?ref=קוד נרשם לקמפיין, והזמנה שלו בתוך 30 יום משויכת אליו (הקמפיין האחרון שנכנס ממנו)
const STORAGE_KEY = 'np_ref';
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[a-z0-9_-]{1,40}$/i;

export function captureCampaignFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const code = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (!code || !CODE_RE.test(code)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, at: Date.now() }));

    // כניסה נספרת פעם אחת לכל קמפיין בכל ביקור (סשן)
    const seenKey = `np_ref_seen_${code}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, '1');
    supabase.rpc('track_campaign_visit', { p_code: code }).then(() => undefined, () => undefined);
  } catch {
    // אחסון חסום בדפדפן: פשוט לא סופרים
  }
}

export function currentCampaign(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.code && CODE_RE.test(saved.code) && Date.now() - Number(saved.at) < WINDOW_MS) return saved.code;
  } catch {
    // ignore
  }
  return null;
}

// משייך הזמנה שנוצרה עכשיו לקמפיין (בסיס הנתונים מוודא שזו ההזמנה של הלקוח הזה ושהקוד קיים)
export async function attachCampaignToOrder(orderId: string, token: string) {
  const code = currentCampaign();
  if (!code) return;
  try {
    await supabase.rpc('attach_order_ref', { p_id: orderId, p_token: token, p_ref: code });
  } catch {
    // השיוך הוא תוספת; ההזמנה עצמה כבר נשמרה
  }
}
