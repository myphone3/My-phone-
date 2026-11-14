// ערכים תזונתיים משוערים למתכון (לפי המצרכים), בעזרת בינה מלאכותית
import { askAI } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 40;

const n = (v) => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : Math.round(+v));

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const ing = (body.ingredients || []).flatMap((g) => [g.title ? `[${g.title}]` : '', ...(g.items || [])]).filter(Boolean).join('\n').slice(0, 4000);
  if (!ing) return Response.json({ error: 'אין מצרכים' }, { status: 400 });
  const prompt = `אתה דיאטן. חשב ערכים תזונתיים משוערים למתכון "${String(body.title || '').slice(0, 120)}"${body.servings ? ` ל-${body.servings} מנות` : ''}.
המצרכים:
${ing}
החזר JSON בלבד:
{"servings": מספר המנות שלפיו חישבת, "per_serving": {"kcal":0,"protein_g":0,"carbs_g":0,"sugar_g":0,"fat_g":0,"sat_fat_g":0,"fiber_g":0,"sodium_mg":0},
 "total_kcal": 0, "allergens": ["גלוטן","ביצים","חלב","אגוזים","בוטנים","סויה","שומשום","דגים" — רק מה שיש], "kashrut": "בשרי" | "חלבי" | "פרווה",
 "labels": ["עד 3 מתוך: צמחוני, טבעוני, ללא גלוטן, דל פחמימות, עשיר בחלבון, דל שומן"], "note": "משפט קצר אחד בעברית"}
אם לא צוין מספר מנות — הערך מספר סביר. השתמש בערכים ממוצעים מקובלים.`;
  try {
    const out = await askAI(req, prompt);
    const p = out?.per_serving || {};
    const nutrition = {
      servings: n(out?.servings),
      per_serving: { kcal: n(p.kcal), protein_g: n(p.protein_g), carbs_g: n(p.carbs_g), sugar_g: n(p.sugar_g), fat_g: n(p.fat_g), sat_fat_g: n(p.sat_fat_g), fiber_g: n(p.fiber_g), sodium_mg: n(p.sodium_mg) },
      total_kcal: n(out?.total_kcal),
      allergens: (Array.isArray(out?.allergens) ? out.allergens : []).map(String).slice(0, 10),
      kashrut: ['בשרי', 'חלבי', 'פרווה'].includes(out?.kashrut) ? out.kashrut : null,
      labels: (Array.isArray(out?.labels) ? out.labels : []).map(String).slice(0, 4),
      note: String(out?.note || '').slice(0, 200),
      at: new Date().toISOString(),
    };
    return Response.json({ nutrition });
  } catch (e) {
    console.error('nutrition failed', e?.message || e);
    return Response.json({ error: 'לא הצלחנו לחשב כרגע, נסו שוב עוד מעט' }, { status: 502 });
  }
}
