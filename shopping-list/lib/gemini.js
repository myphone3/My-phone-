// קריאה ל-Gemini מהשרת. מנסה כמה מודלים לפי הסדר (אם אחד עמוס/לא זמין).
const TEXT_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const VISION_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

export const hasGemini = () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY);

export async function gemini({ system, parts, vision = false, timeoutMs = 25000 }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error('no gemini key');
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : vision ? VISION_MODELS : TEXT_MODELS;
  let lastErr;
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      });
      if (!r.ok) { lastErr = new Error(`${model} ${r.status}`); continue; }
      const j = await r.json();
      const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      return JSON.parse(text.replace(/^```json\s*|```$/g, '') || '{}');
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('gemini failed');
}
