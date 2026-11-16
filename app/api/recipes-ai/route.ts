import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// שירות פנימי לאפליקציית המתכונים (matkonim) ולאפליקציית הקבלות לאחריות: משתמש במפתח Gemini של החנות,
// בלי שהמפתח יוצא מהשרת. מוגן בסיסמה משותפת (RECIPES_AI_SECRET / WARRANTY_AI_SECRET) — אחרים לא יכולים להשתמש.

const MAIN_MODEL = 'gemini-3.8-flash';
// נבדק: 3.6-flash קורא 10 עמודים בכ-12 שניות (בלי "חשיבה"), כשהחדשים יותר לוקחים 90+ שניות או עמוסים
const FAST_MODEL = 'gemini-3.6-flash';
const IMAGE_URL = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(rc|wr)-photos\//;
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
      .sort((a: string, b: string) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]) || Number(a.includes('lite')) - Number(b.includes('lite')))
      .slice(0, 5);
    modelsCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const given = request.headers.get('x-recipes-secret');
  const secrets = [process.env.RECIPES_AI_SECRET, process.env.WARRANTY_AI_SECRET].filter(Boolean);
  if (!given || !secrets.includes(given)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.contents)) return NextResponse.json({ error: 'bad body' }, { status: 400 });

  // תמונות שנשלחו כקישורים (מאחסון התמונות של אפליקציית המתכונים) — מורידים כאן כדי שהבקשה תישאר קטנה
  const imageUrls: string[] = (Array.isArray(body.imageUrls) ? body.imageUrls : [])
    .filter((u: unknown) => typeof u === 'string' && IMAGE_URL.test(u))
    .slice(0, 10);
  if (imageUrls.length) {
    try {
      const images = await Promise.all(imageUrls.map(async (u) => {
        const r = await fetch(u, { signal: AbortSignal.timeout(12_000) });
        if (!r.ok) throw new Error('image ' + r.status);
        // תמונה או PDF (קבלות מהמייל)
        const type = (r.headers.get('content-type') || '').split(';')[0];
        const mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(type) ? type : 'image/jpeg';
        return { mime, data: Buffer.from(await r.arrayBuffer()).toString('base64') };
      }));
      const first = body.contents[0] || { role: 'user', parts: [] };
      first.parts = [...(first.parts || []), ...images.map(({ mime, data }) => ({ inline_data: { mime_type: mime, data } }))];
      body.contents[0] = first;
    } catch (e: any) {
      return NextResponse.json({ error: 'images: ' + String(e?.message || e) }, { status: 502 });
    }
  }
  const generationConfig = body.generationConfig || {};
  const payload = JSON.stringify({ contents: body.contents, generationConfig });
  const { thinkingConfig, ...rest } = generationConfig;
  const plainPayload = thinkingConfig ? JSON.stringify({ contents: body.contents, generationConfig: rest }) : '';
  if (payload.length > 9_000_000) return NextResponse.json({ error: 'too big' }, { status: 413 });

  // משאירים זמן גם למודל גיבוי אם הראשי איטי
  const deadline = started + 112_000;
  // סדר הניסיון: המהיר, הראשי, ואחריהם כל השאר (כולל lite) ומודל ותיק כגיבוי אחרון
  const models = [FAST_MODEL, MAIN_MODEL, ...(await fallbackModels(apiKey)), 'gemini-2.5-flash'].filter((m, i, a) => a.indexOf(m) === i);
  const errors: string[] = [];
  const stop = new AbortController();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // שליחה למודל אחד: עד 50 שניות; אם "עמוס" (503) — ניסיון חוזר אחד אחרי שנייה וחצי;
  // אם לא תומך בהגדרת "חשיבה" — שוב בלעדיה
  const tryModel = async (model: string): Promise<any> => {
    const t0 = Date.now();
    const limit = Math.min(50_000, deadline - Date.now());
    const call = (body: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.any([stop.signal, AbortSignal.timeout(Math.max(1000, t0 + limit - Date.now()))]),
    });
    try {
      let body = payload;
      let res = await call(body);
      let data = await res.json().catch(() => ({}));
      if (res.status === 400 && plainPayload && /think/i.test(String(data?.error?.message || ''))) {
        console.log(`recipes-ai ${model} rejected thinking setting: ${String(data?.error?.message || '').slice(0, 120)}`);
        body = plainPayload;
        res = await call(body);
        data = await res.json().catch(() => ({}));
      }
      if (res.status === 503 && t0 + limit - Date.now() > 10_000) {
        await wait(1500);
        res = await call(body);
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) throw new Error(`${res.status} ${String(data?.error?.message || '').slice(0, 120)}`);
      if (!data?.candidates?.[0]?.content?.parts?.length) throw new Error('empty answer');
      console.log(`recipes-ai ok ${model} ${Date.now() - t0}ms images=${imageUrls.length} thoughts=${data?.usageMetadata?.thoughtsTokenCount ?? 0} out=${data?.usageMetadata?.candidatesTokenCount ?? '?'}`);
      return data;
    } catch (e: any) {
      const why = e?.name === 'TimeoutError' ? 'timeout' : e?.name === 'AbortError' ? 'aborted' : String(e?.message || e);
      if (why !== 'aborted') console.log(`recipes-ai fail ${model} ${Date.now() - t0}ms ${why}`);
      errors.push(`${model}: ${why}`);
      throw e;
    }
  };

  // מתחילים במודל הראשון. מודל נוסף נכנס לפעולה מיד כשמודל נכשל, או אחרי 15 שניות בלי תשובה.
  // התשובה הראשונה שמגיעה מנצחת, והשאר מבוטלים. עד 3 מודלים רצים בו-זמנית.
  const data = await new Promise<any>((resolve) => {
    let next = 0, running = 0, done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (d: any) => { if (done) return; done = true; if (timer) clearTimeout(timer); stop.abort(); resolve(d); };
    const launch = () => {
      if (done) return;
      if (timer) clearTimeout(timer);
      if (next >= models.length || deadline - Date.now() < 6000) { if (!running) finish(null); return; }
      if (running >= 3) { timer = setTimeout(launch, 15_000); return; }
      const model = models[next++];
      running++;
      tryModel(model).then(finish, () => { running--; launch(); });
      timer = setTimeout(launch, 15_000);
    };
    launch();
  });
  if (data) return NextResponse.json(data);
  return NextResponse.json({ error: errors.join(' | ') || 'ai error' }, { status: 502 });
}
