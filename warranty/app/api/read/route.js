// קריאת קבלה מצולמת או PDF: חנות, מוצרים, תאריך, מחיר, אחריות, טלפונים
import { readImages, hasAI, okImage } from '@/lib/ai';
import { CATEGORIES } from '@/lib/warranty';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `אתה קורא קבלות, חשבוניות ותעודות אחריות (בעיקר מישראל) מתוך תמונות או PDF. ייתכנו כמה קבצים של אותה קנייה (ממוספרים לפי הסדר מ-0),
ולפעמים אחד מהם הוא תמונה של המוצר עצמו (לא קבלה).
החזר JSON בלבד במבנה:
{"store":"שם החנות/הרשת (בלי ח.פ וכתובת)","product":"שם המוצר העיקרי, ברור וקצר בעברית (עם דגם/מותג אם כתוב)",
"items":[{"name":"שם מוצר קצר","price":מחיר השורה אחרי הנחות}],
"date":"YYYY-MM-DD","price":מספר הסכום ששולם,
"warranty_months":חודשי אחריות רגילה אם כתוב (שנה=12) אחרת null,
"ext_months":חודשי הרחבת אחריות שנקנתה בתשלום (נוספים על הרגילה) אחרת null,"ext_provider":"מי נותן את ההרחבה אם כתוב","ext_price":מחיר ההרחבה או null,
"serial":"מספר סידורי/IMEI אם מופיע","receipt_no":"מספר חשבונית/קבלה","store_phone":"טלפון החנות","service_phone":"טלפון שירות/מעבדה/יבואן אם מופיע",
"category":"אחת מ: ${CATEGORIES.map((c) => c.k).join(', ')}",
"product_photo_index":מספר הקובץ שמצלם את המוצר עצמו (לא קבלה/חשבונית/תעודה) אחרת null}
כללים:
- product: המוצר היקר/העיקרי שבגללו שומרים את הקבלה (לא משלוח, לא שקית, לא התקנה, לא הרחבת אחריות).
- items: רק מוצרים אמיתיים (לא משלוח/התקנה/הרחבת אחריות/מע"מ/הנחות/תשלום). עד 15.
- תאריך בפורמט ישראלי (יום/חודש/שנה) — המר ל-YYYY-MM-DD. אם לא קריא — "".
- טלפונים כמו שמודפסים (למשל 03-1234567, *1234).
- מספרים כמספרים. מה שלא ברור — השאר ריק או null. אל תמציא.`;

export async function POST(req) {
  if (!hasAI()) return Response.json({ error: 'no-ai' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const urls = (body.images || []).filter(okImage).slice(0, 4);
  if (!urls.length) return Response.json({ error: 'no images' }, { status: 400 });
  try {
    const out = await readImages(PROMPT, urls);
    const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
    const str = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, n) : '');
    const months = (v) => { const m = num(v); return m !== null && m > 0 && m <= 240 ? Math.round(m) : null; };
    const cat = CATEGORIES.find((c) => c.k === out.category)?.k || '';
    const wm = num(out.warranty_months);
    return Response.json({
      store: str(out.store, 80),
      product: str(out.product, 120),
      items: (Array.isArray(out.items) ? out.items : [])
        .map((x) => (typeof x === 'string' ? { name: str(x, 120), price: null } : { name: str(x?.name, 120), price: num(x?.price) }))
        .filter((x) => x.name).slice(0, 15),
      date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || '') ? out.date : '',
      price: num(out.price),
      warranty_months: wm !== null && wm >= 0 && wm <= 240 ? Math.round(wm) : null,
      ext_months: months(out.ext_months),
      ext_provider: str(out.ext_provider, 80),
      ext_price: num(out.ext_price),
      serial: str(out.serial, 80),
      receipt_no: str(out.receipt_no, 40),
      store_phone: str(out.store_phone, 30),
      service_phone: str(out.service_phone, 30),
      category: cat,
      product_photo_index: Number.isInteger(out.product_photo_index) && out.product_photo_index >= 0 && out.product_photo_index < urls.length ? out.product_photo_index : null,
    });
  } catch (e) {
    return Response.json({ error: 'read-failed', detail: String(e.message || e).slice(0, 120) }, { status: 502 });
  }
}
