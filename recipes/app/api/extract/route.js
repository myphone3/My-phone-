// קריאת מתכון מתמונות / עמודי PDF / טקסט בעזרת בינה מלאכותית.
// עדיפות: מפתח Gemini אם הוגדר, אחרת Vercel AI Gateway (עובד אוטומטית ב-Vercel).
import { PROMPT, str, clean } from '@/lib/recipeAi';
import { askAI } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const out = await askAI(req, intro, images);
    const recipes = (Array.isArray(out?.recipes) ? out.recipes : out?.title ? [out] : []).slice(0, 12).map((r) => clean(r, images.length));
    return Response.json({ recipes });
  } catch (e) {
    console.error('extract failed', e);
    return Response.json({ error: 'לא הצלחנו לקרוא את המתכון כרגע', detail: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}
