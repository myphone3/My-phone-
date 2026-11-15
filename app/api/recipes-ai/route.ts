import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// שירות פנימי לאפליקציית המתכונים (matkonim): משתמש במפתח Gemini של החנות,
// בלי שהמפתח יוצא מהשרת. מוגן בסיסמה משותפת (RECIPES_AI_SECRET) — אחרים לא יכולים להשתמש.

const MAIN_MODEL = 'gemini-3.8-flash';
const IMAGE_URL = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/rc-photos\//;
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
      .slice(0, 3);
    modelsCache = { at: Date.now(), list };
    return list;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const secret = process.env.RECIPES_AI_SECRET;
  if (!secret || request.headers.get('x-recipes-secret') !== secret) {
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
        return Buffer.from(await r.arrayBuffer()).toString('base64');
      }));
      const first = body.contents[0] || { role: 'user', parts: [] };
      first.parts = [...(first.parts || []), ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))];
      body.contents[0] = first;
    } catch (e: any) {
      return NextResponse.json({ error: 'images: ' + String(e?.message || e) }, { status: 502 });
    }
  }
  const payload = JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig || {} });
  if (payload.length > 9_000_000) return NextResponse.json({ error: 'too big' }, { status: 413 });

  // משאירים זמן גם למודל גיבוי אם הראשי איטי
  const deadline = Date.now() + 54_000;
  let last = '';
  const models = [MAIN_MODEL, ...(await fallbackModels(apiKey))];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const ms = Math.min(i === 0 ? 30_000 : 40_000, deadline - Date.now());
    if (ms < 4000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(ms),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return NextResponse.json(data);
      last = `${model}: ${res.status} ${String(data?.error?.message || '').slice(0, 120)}`;
    } catch (e: any) {
      last = `${model}: ${e?.name === 'TimeoutError' ? 'timeout' : String(e?.message || e)}`;
    }
  }
  return NextResponse.json({ error: last || 'ai error' }, { status: 502 });
}
