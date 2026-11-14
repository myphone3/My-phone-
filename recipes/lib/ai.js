// חיבור לבינה מלאכותית: מפתח Gemini אם הוגדר, אחרת Vercel AI Gateway (עובד אוטומטית ב-Vercel)
async function viaGemini(key, parts, json) {
  const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let last;
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: json ? 0.1 : 0.5, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      if (!r.ok) { last = new Error('gemini ' + r.status); continue; }
      const j = await r.json();
      const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      return json ? JSON.parse(t || '{}') : t;
    } catch (e) { last = e; }
  }
  throw last || new Error('gemini failed');
}

async function viaGateway(req, content, json) {
  const token = process.env.AI_GATEWAY_API_KEY || req.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('no ai token');
  const models = [process.env.AI_MODEL || 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite'];
  let last;
  for (const model of models) {
    try {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, temperature: json ? 0.1 : 0.5, ...(json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'user', content }] }),
      });
      if (!r.ok) { last = new Error('ai ' + r.status + ' ' + (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content || '{}';
      return json ? JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')) : txt;
    } catch (e) { last = e; }
  }
  throw last || new Error('ai failed');
}


export function askAI(req, prompt, images = [], json = true) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  return key
    ? viaGemini(key, [{ text: prompt }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))], json)
    : viaGateway(req, [{ type: 'text', text: prompt }, ...images.map((d) => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + d } }))], json);
}
