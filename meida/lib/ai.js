// AI (טקסט בלבד): מפתח Gemini אם הוגדר בפרויקט, אחרת דרך השרת של החנות (המפתח נשאר שם)
export const hasAI = () => !!(process.env.GEMINI_API_KEY || (process.env.STORE_AI_URL && process.env.STORE_AI_SECRET));

const clean = (t) => JSON.parse(String(t || '{}').replace(/^```(?:json)?\s*|\s*```$/g, '') || '{}');
const textOf = (j) => j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
const config = { temperature: 0.1, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } };

async function direct(key, prompt) {
  let last;
  for (const model of [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', signal: AbortSignal.timeout(50000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: config }),
      });
      if (!r.ok) { last = new Error(model + ' ' + r.status); continue; }
      return clean(textOf(await r.json()));
    } catch (e) { last = e; }
  }
  throw last || new Error('ai failed');
}

async function viaStore(prompt) {
  const r = await fetch(process.env.STORE_AI_URL, {
    method: 'POST', signal: AbortSignal.timeout(58000),
    headers: { 'Content-Type': 'application/json', 'x-recipes-secret': process.env.STORE_AI_SECRET },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: config }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('store ai ' + r.status + ' ' + (j.error || ''));
  return clean(textOf(j));
}

export function askJSON(prompt) {
  const key = process.env.GEMINI_API_KEY;
  return key ? direct(key, prompt) : viaStore(prompt);
}
