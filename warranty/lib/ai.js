// קריאת תמונת קבלה: מפתח Gemini אם הוגדר, אחרת דרך השרת של החנות (המפתח נשאר שם)
const IMAGE_URL = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/wr-photos\//;
export const okImage = (u) => typeof u === 'string' && IMAGE_URL.test(u);
export const hasAI = () => !!(process.env.GEMINI_API_KEY || (process.env.STORE_AI_URL && process.env.WARRANTY_AI_SECRET));

const clean = (t) => JSON.parse(String(t || '{}').replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}');
const textOf = (j) => j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
const config = { temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };

async function direct(key, prompt, urls) {
  const imgs = await Promise.all(urls.map(async (u) => {
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('image ' + r.status);
    return { inline_data: { mime_type: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') } };
  }));
  let last;
  for (const model of [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', signal: AbortSignal.timeout(40000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, ...imgs] }], generationConfig: config }),
      });
      if (!r.ok) { last = new Error(model + ' ' + r.status); continue; }
      return clean(textOf(await r.json()));
    } catch (e) { last = e; }
  }
  throw last || new Error('ai failed');
}

async function viaStore(prompt, urls) {
  const r = await fetch(process.env.STORE_AI_URL, {
    method: 'POST', signal: AbortSignal.timeout(55000),
    headers: { 'Content-Type': 'application/json', 'x-recipes-secret': process.env.WARRANTY_AI_SECRET },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], imageUrls: urls, generationConfig: config }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('store ai ' + r.status + ' ' + (j.error || ''));
  return clean(textOf(j));
}

export function readImages(prompt, urls) {
  const key = process.env.GEMINI_API_KEY;
  return key ? direct(key, prompt, urls) : viaStore(prompt, urls);
}
