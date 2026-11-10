import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BUSINESS } from '@/lib/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

// קטלוג קצר לנציג. נשמר 10 דקות בזיכרון, ואחרי זה מתרענן ברקע (הלקוח לא מחכה לו)
const CATALOG_TTL = 10 * 60_000;
let cache: { at: number; text: string; ids: Set<string> } | null = null;
let loading: Promise<{ at: number; text: string; ids: Set<string> }> | null = null;

async function loadCatalog() {
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
      plain(p.short_description, 120),
    ]
      .filter(Boolean)
      .join(' | ');
  });
  cache = { at: Date.now(), text: rows.join('\n'), ids: new Set((data || []).map((p: any) => String(p.id))) };
  return cache;
}

async function catalog() {
  const refresh = () => {
    if (!loading) loading = loadCatalog().finally(() => (loading = null));
    return loading;
  };
  if (cache) {
    if (Date.now() - cache.at > CATALOG_TTL) refresh().catch(() => {});
    return cache;
  }
  return refresh();
}

const RULES = `אתה "הנציג החכם" של חנות NEW PHONE: חנות מכשירים כשרים, תומכי כשר, נגנים ואביזרים לסלולר.
דבר בעברית פשוטה וחמה, כמו מוכר טוב בחנות. פנה בלשון רבים ("אתם").
תשובות קצרות מאוד: 1-3 משפטים. בלי הקדמות ובלי חזרה על השאלה.

עובדות שחשוב לדעת:
- בטלפונים יש כשרות אחת בלבד: ועדת הרבנים לענייני תקשורת. מכשיר כשר = שיחות בלבד (בלי SMS, מצלמה, אינטרנט ואפליקציות).
- תומך כשר = עובד עם קו כשר, ובוחרים גרסה: נגן מצלמה / נגן גלריה (עם או בלי SMS), או כשר פליי (חנות אפליקציות מסוננת עם וואטסאפ, Waze ומוביט). באף גרסה אין דפדפן וגוגל.
- "גירסה רגילה" = פתוח בלי סינון.
- משלוח: ${BUSINESS.shippingDays}. וואטסאפ / טלפון של החנות: ${BUSINESS.phone}.

איך לעבוד:
- המלץ רק על מוצרים מהרשימה למטה. לעולם אל תמציא מוצר, מחיר או תכונה.
- אם חסר מידע כדי להמליץ, שאל שאלה אחת קצרה (למשל: למי המכשיר? מה חייב להיות בו? מה התקציב?).
- כשממליצים: עד 3 מוצרים, ולכל אחד חצי שורה למה הוא מתאים (ואיזו גרסה, אם רלוונטי). כרטיס המוצר עם המחיר יוצג ללקוח אוטומטית.
- על הזמנות קיימות, החזרות או תקלות: הפנה לוואטסאפ של החנות.
- נושאים שלא קשורים לחנות: ענה בנימוס שאתה עוזר רק בענייני החנות.

פורמט: כתוב את התשובה ללקוח כטקסט רגיל (בלי JSON ובלי כוכביות).
אם המלצת על מוצרים, סיים בשורה אחרונה נפרדת בדיוק כך: [[ids:מזהה1,מזהה2]] (רק מזהים מהרשימה).`;

// המודל הראשי (כמו בעוזר ה-AI בפאנל). כשהוא עמוס או איטי, עוברים מהר למודל Flash אחר שזמין במפתח
const MAIN_MODEL = 'gemini-3.8-flash';
let modelsCache: { at: number; list: string[] } | null = null;

async function fallbackModels(apiKey: string): Promise<string[]> {
  if (modelsCache && Date.now() - modelsCache.at < 60 * 60 * 1000) return modelsCache.list;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`, { signal: AbortSignal.timeout(3000) });
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
      .slice(0, 3);
    modelsCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

// בלי "חשיבה" ארוכה: זה מה שהכי מאט את התשובה. בגרסה 3 ומעלה זה thinkingLevel, ב-2.5 זה תקציב 0
function thinkingFor(model: string) {
  const v = parseFloat(model.split('-')[1]) || 0;
  if (v >= 3) return { thinkingLevel: 'minimal' };
  if (v >= 2.5) return { thinkingBudget: 0 };
  return null;
}

// פותח שיחה זורמת מול המודל. מחכה רק לתחילת התשובה (עד firstMs), ואז הטקסט זורם ללקוח מיד
async function openStream(apiKey: string, model: string, system: string, contents: any[], firstMs: number, withThinking = true) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), firstMs);
  try {
    const thinkingConfig = withThinking ? thinkingFor(model) : null;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400, ...(thinkingConfig ? { thinkingConfig } : {}) },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      const message = String(data?.error?.message || '');
      // מודל שלא מכיר את הגדרת החשיבה: מנסים אותו שוב בלעדיה
      if (res.status === 400 && thinkingConfig && /think/i.test(message)) return openStream(apiKey, model, system, contents, firstMs, false);
      return { ok: false as const, message: `${model}: ${res.status} ${message}` };
    }
    const reader = res.body.getReader();
    const first = await reader.read(); // מחכים לחלק הראשון בתוך מגבלת הזמן
    clearTimeout(timer);
    // אחרי שהתחיל לענות, נותנים לו לסיים (עד 20 שניות)
    const done = setTimeout(() => ctrl.abort(), 20_000);
    return { ok: true as const, reader, first, stop: () => clearTimeout(done) };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false as const, message: `${model}: ${e?.name === 'AbortError' ? 'timeout' : String(e?.message || e)}` };
  }
}

const SEP = '\u0000'; // מפריד בין הטקסט ללקוח לבין רשימת המוצרים בסוף
const fail = (text: string) => new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

// חימום: החלונית פותחת את זה כשהלקוח פותח את הצ'אט, כדי שהקטלוג והשרת יהיו מוכנים לפני השאלה
export async function GET() {
  try {
    await catalog();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) fallbackModels(apiKey).catch(() => {});
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (limited(ip)) return fail('קיבלנו הרבה הודעות ממך בזמן קצר. נסו שוב בעוד כמה דקות, או כתבו לנו בוואטסאפ.');

    const body = await request.json().catch(() => null);
    const messages: { role: 'user' | 'assistant'; text: string }[] = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: any) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-MAX_MESSAGES)
      .map((m: any) => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'אין הודעה' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return fail('הנציג החכם עוד לא זמין כרגע. בינתיים אפשר ללחוץ על "איזה מכשיר מתאים לי?" או לכתוב לנו בוואטסאפ.');

    const cat = await catalog();
    const system = `${RULES}\n\nהמוצרים שבחנות עכשיו:\n${cat.text}`;
    const contents = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));

    // המודל הראשי. אם הוא עמוס או לא התחיל לענות תוך כמה שניות, עוברים מיד לחלופי
    let s: Awaited<ReturnType<typeof openStream>> = await openStream(apiKey, MAIN_MODEL, system, contents, 7000);
    if (!s.ok) {
      for (const model of await fallbackModels(apiKey)) {
        s = await openStream(apiKey, model, system, contents, 6000);
        if (s.ok) break;
      }
    }
    if (!s.ok) {
      console.error('assistant error:', s.message);
      return fail('הנציג עמוס כרגע. נסו שוב עוד רגע, או כתבו לנו בוואטסאפ ונשמח לעזור.');
    }

    const { reader, first, stop } = s;
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let sse = ''; // שאריות של שורות SSE שעוד לא נגמרו
        let full = ''; // כל הטקסט שהמודל כתב
        let sent = 0; // כמה מהטקסט כבר נשלח ללקוח
        const push = (final: boolean) => {
          // את מה שאחרי [[ לא שולחים (זו רשימת המוצרים). שומרים סוף קצר, למקרה שה-[[ עוד בדרך
          const cut = full.indexOf('[[');
          const upto = cut >= 0 ? cut : final ? full.length : Math.max(sent, full.length - 1);
          if (upto > sent) {
            controller.enqueue(enc.encode(full.slice(sent, upto)));
            sent = upto;
          }
        };
        const take = (chunk: string) => {
          sse += chunk;
          const lines = sse.split('\n');
          sse = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const d = JSON.parse(line.slice(5));
              for (const part of d.candidates?.[0]?.content?.parts || []) if (part.text && !part.thought) full += part.text;
            } catch {
              // ignore
            }
          }
          push(false);
        };
        try {
          let r = first;
          while (!r.done) {
            take(dec.decode(r.value, { stream: true }));
            r = await reader.read();
          }
        } catch {
          // נקטע באמצע: שולחים מה שיש
        } finally {
          stop();
        }
        push(true);
        const m = full.match(/\[\[\s*ids?\s*:([^\]]*)\]\]?/i);
        const productIds = m
          ? Array.from(new Set(m[1].split(/[,\s]+/).map((x) => x.trim()).filter((id) => cat.ids.has(id)))).slice(0, 3)
          : [];
        if (!full.trim()) controller.enqueue(enc.encode('סליחה, לא הצלחתי להבין. אפשר לנסח שוב?'));
        controller.enqueue(enc.encode(SEP + JSON.stringify({ productIds })));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
    });
  } catch (err: any) {
    console.error('assistant error:', err);
    return fail('משהו השתבש אצלנו. נסו שוב עוד רגע, או כתבו לנו בוואטסאפ ונשמח לעזור.');
  }
}
