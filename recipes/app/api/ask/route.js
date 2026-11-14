// "שאלו את השף": שאלה על המתכון (תחליפים, המרות, טיפים) — תשובה קצרה בעברית
import { askAI } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 40;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const q = String(body.question || '').trim().slice(0, 500);
  if (!q) return Response.json({ error: 'אין שאלה' }, { status: 400 });
  const r = body.recipe || {};
  const recipe = [
    `שם: ${String(r.title || '').slice(0, 120)}`,
    r.servings ? `מנות: ${r.servings}` : '',
    'מצרכים:\n' + (r.ingredients || []).flatMap((g) => [g.title ? `[${g.title}]` : '', ...(g.items || [])]).filter(Boolean).join('\n').slice(0, 4000),
    'הכנה:\n' + (r.steps || []).flatMap((g) => [g.title ? `[${g.title}]` : '', ...(g.items || [])]).filter(Boolean).join('\n').slice(0, 5000),
    body.step ? `המשתמש נמצא עכשיו בשלב: ${String(body.step).slice(0, 400)}` : '',
  ].filter(Boolean).join('\n');
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map((h) => `${h.role === 'user' ? 'שאלה' : 'תשובה'}: ${String(h.text || '').slice(0, 600)}`).join('\n');
  const prompt = `אתה שף ביתי חם ומנוסה שעוזר למישהו שמבשל עכשיו. ענה בעברית פשוטה, קצר ומעשי (עד 4 משפטים או רשימה קצרה), בלי הקדמות.
אם שואלים על תחליף — תן תחליף מדויק עם כמות. אם שואלים על המרה (גרמים/כוסות, תבנית אחרת, כשרות פרווה/חלבי) — תן מספרים.
אם השאלה לא קשורה לבישול, ענה בנימוס שאתה עוזר רק במטבח.

המתכון:
${recipe}
${history ? '\nשיחה קודמת:\n' + history : ''}

השאלה: ${q}`;
  try {
    const answer = await askAI(req, prompt, [], false);
    return Response.json({ answer: String(answer || '').trim().slice(0, 2000) });
  } catch (e) {
    console.error('ask failed', e?.message || e);
    return Response.json({ error: 'השף לא זמין כרגע, נסו שוב עוד רגע', detail: String(e?.message || e).slice(0, 200) }, { status: 502 });
  }
}
