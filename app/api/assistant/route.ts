import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BUSINESS } from '@/lib/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// הנציג החכם (AI) של החנות: עונה ללקוחות וממליץ על מכשירים, רק מתוך המוצרים שבאמת יש באתר.
// המפתח (GEMINI_API_KEY) נשאר בשרת.

const MAX_MESSAGES = 12;
const MAX_CHARS = 600;

// הגבלה פשוטה: עד 30 הודעות ל-10 דקות לכל כתובת
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 30;
}

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const v = JSON.parse(val);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
};
const plain = (s: any, n = 160) =>
  String(s || '')
    .replace(/[#*_`>\n\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, n);
const vName = (v: any) => (typeof v === 'string' ? v : v?.name || v?.title || '');

// קטלוג קצר לנציג (נשמר דקה בזיכרון)
let cache: { at: number; text: string; ids: Set<string> } | null = null;
async function catalog() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase.from('products').select('*').or('is_published.is.null,is_published.eq.true');
  const rows = (data || []).map((p: any) => {
    const price = Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;
    const versions = asArray(p.product_variants || p.versions || p.product_versions).map(vName).filter(Boolean);
    const out = p.stock !== null && p.stock !== undefined && p.stock !== '' && Number(p.stock) <= 0;
    return [
      `id=${p.id}`,
      p.name,
      p.category && `קטגוריה: ${p.category}`,
      p.brand && `מותג: ${p.brand}`,
      `מחיר: ₪${Math.round(price)}`,
      p.kosher && `כשרות: ${p.kosher}`,
      versions.length && `גרסאות: ${versions.join(' / ')}`,
      out && 'אזל מהמלאי',
      plain(p.short_description),
    ]
      .filter(Boolean)
      .join(' | ');
  });
  cache = { at: Date.now(), text: rows.join('\n'), ids: new Set((data || []).map((p: any) => String(p.id))) };
  return cache;
}

const RULES = `אתה "הנציג החכם" של חנות NEW PHONE: חנות מכשירים כשרים, תומכי כשר, נגנים ואביזרים לסלולר.
דבר בעברית פשוטה וחמה, במשפטים קצרים, כמו מוכר טוב בחנות. בלי מילים מסובכות. פנה בלשון רבים ("אתם").

עובדות שחשוב לדעת:
- בטלפונים יש כשרות אחת בלבד: ועדת הרבנים לענייני תקשורת. מכשיר כשר = שיחות בלבד (בלי SMS, מצלמה, אינטרנט ואפליקציות).
- תומך כשר = עובד עם קו כשר, ובוחרים גרסה: נגן מצלמה / נגן גלריה (עם או בלי SMS), או כשר פליי (חנות אפליקציות מסוננת עם וואטסאפ, Waze ומוביט). באף גרסה אין דפדפן וגוגל.
- "גירסה רגילה" = פתוח בלי סינון.
- משלוח: ${BUSINESS.shippingDays}. וואטסאפ / טלפון של החנות: ${BUSINESS.phone}.

איך לעבוד:
- המלץ רק על מוצרים מהרשימה למטה. לעולם אל תמציא מוצר, מחיר או תכונה.
- אם חסר מידע כדי להמליץ, שאל שאלה אחת קצרה (למשל: למי המכשיר? מה חייב להיות בו? מה התקציב?).
- כשממליצים: עד 3 מוצרים, ולכל אחד שורה למה הוא מתאים, ואם רלוונטי איזו גרסה לבחור.
- על הזמנות קיימות, החזרות או תקלות: הפנה לוואטסאפ של החנות.
- נושאים שלא קשורים לחנות: ענה בנימוס שאתה עוזר רק בענייני החנות.

החזר JSON בלבד, בדיוק במבנה: {"reply": "הטקסט ללקוח", "productIds": ["id של מוצר מומלץ", ...]}
productIds: רק מזהים מהרשימה, ורק כשאתה ממליץ על מוצרים מסוימים (אחרת רשימה ריקה).`;

// המודל הראשי (כמו בעוזר ה-AI בפאנל). כשהוא עמוס, מנסים שוב ואז עוברים למודל Flash אחר שזמין במפתח
const MAIN_MODEL = 'gemini-3.8-flash';
let modelsCache: { at: number; list: string[] } | null = null;

async function fallbackModels(apiKey: string): Promise<string[]> {
  if (modelsCache && Date.now() - modelsCache.at < 60 * 60 * 1000) return modelsCache.list;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const list: string[] = (data.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((n: string) => /^gemini-[\d.]+-flash(-lite)?$/.test(n) && n !== MAIN_MODEL)
      // החדשים קודם, ו-flash לפני flash-lite
      .sort((a: string, b: string) => {
        const va = parseFloat(a.split('-')[1]);
        const vb = parseFloat(b.split('-')[1]);
        return vb - va || Number(a.includes('lite')) - Number(b.includes('lite'));
      })
      .slice(0, 4);
    modelsCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

const busy = (status: number, msg: string) => status === 429 || status === 503 || status === 500 || /high demand|overloaded|unavailable|try again/i.test(msg);

// כל ניסיון מוגבל בזמן, כדי שמודל עמוס לא יתקע את כל השיחה
async function callModel(apiKey: string, model: string, contents: any[], ms: number) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
      signal: AbortSignal.timeout(ms),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, message: String(data?.error?.message || '') };
  } catch (e: any) {
    return { ok: false, status: 504, data: null, message: e?.name === 'TimeoutError' ? 'timeout' : String(e?.message || e) };
  }
}

async function generate(apiKey: string, contents: any[]) {
  const deadline = Date.now() + 45_000;
  const left = (max: number) => Math.max(0, Math.min(max, deadline - Date.now()));
  let last = '';
  // המודל הראשי, ואם הוא עמוס מיד עוברים למודלים חלופיים (ובסוף עוד ניסיון אחד על הראשי)
  const order = [MAIN_MODEL, ...(await fallbackModels(apiKey)), MAIN_MODEL];
  for (const model of order) {
    const ms = left(14_000);
    if (ms < 3000) break;
    const r = await callModel(apiKey, model, contents, ms);
    if (r.ok) return r.data;
    last = `${model}: ${r.message}`;
    if (!busy(r.status, r.message) && r.status !== 504 && r.status !== 404 && r.status !== 400) break;
  }
  throw new Error(last || 'AI error');
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (limited(ip)) {
      return NextResponse.json({ reply: 'קיבלנו הרבה הודעות ממך בזמן קצר. נסו שוב בעוד כמה דקות, או כתבו לנו בוואטסאפ.', productIds: [] });
    }

    const body = await request.json().catch(() => null);
    const messages: { role: 'user' | 'assistant'; text: string }[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-MAX_MESSAGES)
      .map((m: any) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'אין הודעה' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: 'הנציג החכם עוד לא זמין כרגע. בינתיים אפשר ללחוץ על "איזה מכשיר מתאים לי?" או לכתוב לנו בוואטסאפ.',
        productIds: [],
      });
    }

    const cat = await catalog();
    const intro = `${RULES}\n\nהמוצרים שבחנות עכשיו:\n${cat.text}`;
    // ההנחיות והקטלוג נשלחים כהודעה הראשונה בשיחה
    const contents = [
      { role: 'user', parts: [{ text: intro }] },
      { role: 'model', parts: [{ text: '{"reply":"הבנתי. אני מוכן לעזור ללקוחות.","productIds":[]}' }] },
      ...messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
    ];

    const data = await generate(apiKey, contents);

    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let reply = '';
    let productIds: string[] = [];
    try {
      const m = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      reply = String(parsed.reply || '').trim();
      productIds = (Array.isArray(parsed.productIds) ? parsed.productIds : []).map(String).filter((id: string) => cat.ids.has(id)).slice(0, 3);
    } catch {
      reply = text.trim();
    }
    if (!reply) reply = 'סליחה, לא הצלחתי להבין. אפשר לנסח שוב?';
    return NextResponse.json({ reply, productIds });
  } catch (err: any) {
    console.error('assistant error:', err);
    return NextResponse.json({
      reply: 'משהו השתבש אצלנו. נסו שוב עוד רגע, או כתבו לנו בוואטסאפ ונשמח לעזור.',
      productIds: [],
    });
  }
}
