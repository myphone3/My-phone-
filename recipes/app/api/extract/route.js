// קריאת מתכון מתמונות / עמודי PDF / טקסט בעזרת בינה מלאכותית.
// עדיפות: מפתח Gemini אם הוגדר, אחרת Vercel AI Gateway (עובד אוטומטית ב-Vercel).
import { CATEGORIES } from '@/lib/recipe';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `אתה עוזר שמסדר מתכונים. קיבלת צילומים/עמודים של מתכון (אולי בכתב יד, אולי מספר בישול) ו/או טקסט.
החזר JSON בלבד בצורה:
{"recipes":[{
 "title":"שם המתכון",
 "description":"משפט קצר אחד על המנה (אם יש במקור, אחרת ריק)",
 "category":"אחת מ: ${CATEGORIES.join(' | ')}",
 "servings": מספר מנות או null,
 "prep_minutes": זמן הכנה בדקות או null,
 "cook_minutes": זמן בישול/אפייה בדקות או null,
 "ingredients":[{"title":"שם החלק (למשל: לבצק, למילוי, לרוטב) או ריק אם יש חלק אחד","items":["2 כוסות קמח","1 כפית מלח"]}],
 "steps":[{"title":"שם החלק (למשל: הכנת הבצק, המילוי, הרכבה ואפייה) או ריק","items":["שלב ברור אחד","שלב נוסף"]}],
 "tips":["טיפ או הערה מהמקור"],
 "tags":["עד 4 תגיות קצרות, למשל: פרווה, ללא גלוטן, מהיר"],
 "photo": {"image": מספר התמונה (מתחיל ב-0) שבה יש צילום של המנה המוכנה, "box":[ymin,xmin,ymax,xmax] בסקאלה 0-1000} או null אם אין צילום של מנה
}]}
כללים:
- כתוב בעברית. אם המקור בשפה אחרת, תרגם לעברית טבעית.
- אל תמציא מצרכים, כמויות או שלבים שלא מופיעים במקור. אם משהו לא קריא, כתוב את מה שנראה הכי סביר וסמן "(?)".
- כל מצרך בשורה משלו, הכמות בהתחלה ("3 ביצים", "½ כוס שמן"). בלי מספור ובלי תבליטים.
- פרק את אופן ההכנה לשלבים קצרים וברורים לפי סדר העבודה, פעולה אחת או שתיים בכל שלב, בלי מספור. שמור על זמנים וטמפרטורות ("אופים 35 דקות ב-180 מעלות").
- חלק לחלקים רק כשבמתכון באמת יש כמה חלקים (בצק, מילוי, ציפוי וכו'). אחרת חלק אחד עם title ריק.
- אם בעמודים יש כמה מתכונים שונים, החזר כל אחד בנפרד במערך recipes.
- אם אין מתכון בכלל, החזר {"recipes":[]}.`;

async function viaGemini(key, parts) {
  const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let last;
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });
      if (!r.ok) { last = new Error('gemini ' + r.status); continue; }
      const j = await r.json();
      return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}');
    } catch (e) { last = e; }
  }
  throw last || new Error('gemini failed');
}

async function viaGateway(req, content) {
  const token = process.env.AI_GATEWAY_API_KEY || req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('no ai token');
  const models = [process.env.AI_MODEL || 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite'];
  let last;
  for (const model of models) {
    try {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
      });
      if (!r.ok) { last = new Error('ai ' + r.status + ' ' + (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content || '{}';
      return JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (e) { last = e; }
  }
  throw last || new Error('ai failed');
}

const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v) => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : Math.round(+v * 10) / 10);
const list = (v, n = 80) => (Array.isArray(v) ? v.map((x) => str(String(x ?? ''), 500)).filter(Boolean).slice(0, n) : []);
const grp = (v) => (Array.isArray(v) ? v.map((g) => ({ title: str(g?.title, 80), items: list(g?.items) })).filter((g) => g.items.length).slice(0, 12) : []);

function clean(r, imageCount) {
  const photo = r?.photo && Number.isInteger(+r.photo.image) && +r.photo.image >= 0 && +r.photo.image < imageCount && Array.isArray(r.photo.box) && r.photo.box.length === 4
    ? { image: +r.photo.image, box: r.photo.box.map((n) => Math.max(0, Math.min(1000, +n || 0))) } : null;
  return {
    title: str(r?.title, 120) || 'מתכון',
    description: str(r?.description, 300),
    category: CATEGORIES.includes(r?.category) ? r.category : 'אחר',
    servings: num(r?.servings),
    prep_minutes: num(r?.prep_minutes),
    cook_minutes: num(r?.cook_minutes),
    ingredients: grp(r?.ingredients),
    steps: grp(r?.steps),
    tips: list(r?.tips, 20),
    tags: list(r?.tags, 4).map((t) => t.slice(0, 24)),
    photo,
  };
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/rc-photos/`;
  const urls = (Array.isArray(body.images) ? body.images : []).filter((u) => typeof u === 'string' && u.startsWith(base)).slice(0, 10);
  const text = str(body.text, 20000);
  if (!urls.length && !text) return Response.json({ error: 'אין מה לקרוא' }, { status: 400 });

  try {
    const images = await Promise.all(urls.map(async (u) => {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('image ' + r.status);
      return Buffer.from(await r.arrayBuffer()).toString('base64');
    }));
    const intro = PROMPT + (text ? `\n\nטקסט מהמקור:\n${text}` : '') + (images.length ? `\n\nמצורפות ${images.length} תמונות (מספור מ-0 לפי הסדר).` : '');
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    const out = key
      ? await viaGemini(key, [{ text: intro }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))])
      : await viaGateway(req, [{ type: 'text', text: intro }, ...images.map((d) => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + d } }))]);
    const recipes = (Array.isArray(out?.recipes) ? out.recipes : out?.title ? [out] : []).slice(0, 12).map((r) => clean(r, images.length));
    return Response.json({ recipes });
  } catch (e) {
    console.error('extract failed', e);
    return Response.json({ error: 'לא הצלחנו לקרוא את המתכון כרגע', detail: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}
