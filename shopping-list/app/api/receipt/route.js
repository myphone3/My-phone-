// קריאת חשבונית מצולמת: חנות, תאריך, סה"כ, וכל שורת מוצר עם מחיר — ומתאים לפריטים ברשימה
import { gemini, hasGemini } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `אתה קורא חשבוניות/קבלות של סופרמרקטים בישראל מתוך תמונות (ייתכנו כמה תמונות של אותה קבלה ארוכה — אחד אותן בלי כפילויות).
החזר JSON בלבד במבנה:
{"store":"שם הרשת והסניף","date":"YYYY-MM-DD או ריק","total":מספר הסכום ששולם,"lines":[{"raw":"השורה כפי שמודפסת","name":"שם מוצר ברור וקצר בעברית","qty":כמות או משקל,"unit":"ק\\"ג או ריק","unit_price":מחיר ליחידה,"total":מחיר השורה אחרי הנחות,"match_id":"מזהה פריט מהרשימה או null"}]}
כללים:
- רק שורות של מוצרים. דלג על סכום ביניים, מע"מ, אמצעי תשלום, עודף, מועדון, נקודות.
- שורת הנחה/מבצע (מספר שלילי) — הפחת אותה מהמוצר שמעליה, אל תחזיר אותה כשורה נפרדת.
- פיקדון על בקבוקים — הוסף למחיר הבקבוקים. שקיות קנייה — שורה בשם "שקיות".
- מוצר שנשקל: qty = המשקל בק"ג, unit = "ק\\"ג".
- התאם כל שורה לפריט ברשימת הקניות לפי המשמעות (למשל "קוטג תנו 5% 250ג" ↔ "קוטג'"), אחרת match_id = null. אל תתאים שני פריטים שונים לאותו מזהה אלא אם זה באמת אותו מוצר.
- מספרים כמספרים (לא מחרוזות). אם לא קריא — השמט את השורה.`;

export async function POST(req) {
  if (!hasGemini()) return Response.json({ error: 'no-ai' }, { status: 503 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const urls = (body.images || []).filter((u) => typeof u === 'string' && /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\//.test(u)).slice(0, 4);
  if (!urls.length) return Response.json({ error: 'no images' }, { status: 400 });
  const items = (body.items || []).slice(0, 150).map((i) => ({ id: String(i.id), name: String(i.name).slice(0, 60) }));

  try {
    const imgs = await Promise.all(urls.map(async (u) => {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('image fetch ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      return { inlineData: { mimeType: r.headers.get('content-type') || 'image/jpeg', data: buf.toString('base64') } };
    }));
    const out = await gemini({
      system: SYSTEM,
      vision: true,
      timeoutMs: 25000,
      parts: [...imgs, { text: 'רשימת הקניות (id ושם): ' + JSON.stringify(items) }],
    });
    const ids = new Set(items.map((i) => i.id));
    const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
    const lines = (Array.isArray(out.lines) ? out.lines : [])
      .map((l) => ({
        raw: String(l.raw || '').slice(0, 80),
        name: String(l.name || l.raw || '').slice(0, 60).trim(),
        qty: num(l.qty) || 1,
        unit: l.unit ? String(l.unit).slice(0, 10) : '',
        unit_price: num(l.unit_price),
        total: num(l.total),
        match_id: l.match_id && ids.has(String(l.match_id)) ? String(l.match_id) : null,
      }))
      .filter((l) => l.name && l.total !== null);
    return Response.json({
      store: String(out.store || '').slice(0, 60),
      date: /^\d{4}-\d{2}-\d{2}$/.test(out.date || '') ? out.date : '',
      total: num(out.total),
      lines,
    });
  } catch (e) {
    return Response.json({ error: 'read-failed', detail: String(e.message || e).slice(0, 80) }, { status: 502 });
  }
}
