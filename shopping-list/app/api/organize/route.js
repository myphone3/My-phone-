// סידור חכם עם בינה מלאכותית (דרך Vercel AI Gateway):
// 1) text: הקלטה קולית / טקסט חופשי → שורה לכל פריט
// 2) names: מוצרים שהמילון לא הכיר → מחלקה ואימוג'י
import { CATEGORIES } from '@/lib/catalog';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CATS = CATEGORIES.map((c) => c.id);

async function viaGemini(key, system, user) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const j = await r.json();
  return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
}

async function viaGateway(req, system, user) {
  const token = process.env.AI_GATEWAY_API_KEY || req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('no ai token');
  const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'google/gemini-2.5-flash-lite',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error('ai ' + r.status);
  const j = await r.json();
  return JSON.parse(j.choices?.[0]?.message?.content || '{}');
}

// עדיפות: מפתח Gemini אם הוגדר, אחרת Vercel AI Gateway
function ask(req, system, user) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  return key ? viaGemini(key, system, user) : viaGateway(req, system, user);
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  try {
    if (typeof body.text === 'string' && body.text.trim()) {
      const out = await ask(req,
        'אתה מסדר רשימות קניות בעברית. מקבלים טקסט חופשי או תמלול קולי (בלי פסיקים). ' +
        'פרק אותו לפריטים נפרדים. החזר JSON: {"lines":["..."]} — שורה לכל פריט, בפורמט "כמות יחידה שם (הערה)" כשיש כמות/הערה, למשל "2 ק\\"ג עגבניות", "חלב 3%", "6 ביצים". ' +
        'אל תמציא פריטים. מספרים במילים הפוך לספרות.',
        body.text.slice(0, 2000));
      return Response.json({ lines: Array.isArray(out.lines) ? out.lines.slice(0, 80).map(String) : [] });
    }
    if (Array.isArray(body.names) && body.names.length) {
      const names = body.names.slice(0, 40).map((n) => String(n).slice(0, 60));
      const out = await ask(req,
        'סווג מוצרי סופר ישראלי למחלקות. המחלקות האפשריות בלבד: ' + CATS.join(' | ') +
        '. החזר JSON: {"items":[{"name":"...","category":"...","emoji":"אימוג\'י אחד מתאים"}]} באותו סדר.',
        JSON.stringify(names));
      const items = (out.items || []).filter((i) => i && CATS.includes(i.category));
      return Response.json({ items });
    }
    return Response.json({ error: 'nothing to do' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: 'ai-unavailable', detail: String(e.message || e).slice(0, 60) }, { status: 503 });
  }
}
