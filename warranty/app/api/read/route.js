// קריאת קבלה מצולמת: חנות, מוצר, תאריך, מחיר, ואחריות (אם כתובה)
import { readImages, hasAI, okImage } from '@/lib/ai';
import { CATEGORIES } from '@/lib/warranty';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `אתה קורא קבלות, חשבוניות ותעודות אחריות (בעיקר מישראל) מתוך תמונות. ייתכנו כמה תמונות של אותה קנייה.
החזר JSON בלבד במבנה:
{"store":"שם החנות/הרשת (בלי ח.פ וכתובת)","product":"שם המוצר העיקרי, ברור וקצר בעברית (עם דגם/מותג אם כתוב)","items":["כל המוצרים שבקבלה בשם קצר"],"date":"YYYY-MM-DD","price":מספר הסכום ששולם,"warranty_months":מספר חודשי אחריות אם כתוב בקבלה/בתעודה (שנה=12) אחרת null,"serial":"מספר סידורי/IMEI אם מופיע אחרת ריק","category":"אחת מ: ${CATEGORIES.map((c) => c.k).join(', ')}"}
כללים:
- product: המוצר היקר/העיקרי שבגללו שומרים את הקבלה (לא משלוח, לא שקית, לא התקנה).
- items: רק מוצרים אמיתיים, בלי מע"מ, סכומי ביניים, הנחות ואמצעי תשלום. עד 15.
- תאריך בפורמט ישראלי (יום/חודש/שנה) — המר ל-YYYY-MM-DD. אם לא קריא — "".
- מספרים כמספרים. מה שלא ברור — השאר ריק או null. אל תמציא.`;

export async function POST(req) {
  if (!hasAI()) return Response.json({ error: 'no-ai' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const urls = (body.images || []).filter(okImage).slice(0, 4);
  if (!urls.length) return Response.json({ error: 'no images' }, { status: 400 });
  try {
    const out = await readImages(PROMPT, urls);
    const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
    const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const cat = CATEGORIES.find((c) => c.k === out.category)?.k || '';
    const wm = num(out.warranty_months);
    return Response.json({
      store: str(out.store, 80),
      product: str(out.product, 120),
      items: (Array.isArray(out.items) ? out.items : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 15),
      date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || '') ? out.date : '',
      price: num(out.price),
      warranty_months: wm !== null && wm >= 0 && wm <= 240 ? Math.round(wm) : null,
      serial: str(out.serial, 80),
      category: cat,
    });
  } catch (e) {
    return Response.json({ error: 'read-failed', detail: String(e.message || e).slice(0, 120) }, { status: 502 });
  }
}
