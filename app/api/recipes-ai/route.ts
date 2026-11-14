import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// שירות פנימי לאפליקציית המתכונים (matkonim): משתמש במפתח Gemini של החנות,
// בלי שהמפתח יוצא מהשרת. מוגן בסיסמה משותפת (RECIPES_AI_SECRET) — אחרים לא יכולים להשתמש.

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
  const payload = JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig || {} });
  if (payload.length > 9_000_000) return NextResponse.json({ error: 'too big' }, { status: 413 });

  const deadline = Date.now() + 55_000;
  let last = '';
  for (const model of [MAIN_MODEL, ...(await fallbackModels(apiKey))]) {
    const ms = Math.min(40_000, deadline - Date.now());
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
