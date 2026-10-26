// AI salary advisor: forwards a signed-in worker's chat to Gemini, with their numbers as context. The key never reaches the browser.
const SUPABASE_URL = "https://mkqjysfflavzfkckiuil.supabase.co";
const SUPABASE_KEY = "sb_publishable_xCLvDfV3wAK4abkqlQrXBg_CXm39XfW";

const SYSTEM = `You are "יועץ המשכורת", a friendly salary-planning advisor inside an Israeli hourly-worker attendance app.
Always answer in Hebrew, warm and practical, short (up to ~120 words unless asked for detail). Use gender-neutral phrasing.
You get the worker's real data as JSON: pay settings, overtime rules, this pay period so far, remaining work days,
recent months, and plans already calculated by the app (hours per day needed for the goal, by days per week).
Rely on those calculated numbers; do not contradict them. When you must calculate something new, keep it simple,
state the assumption, and round sensibly (hours as H:MM, money with ₪). Overtime per day: above the threshold the first
hours are 125% and then 150%; Saturday at the weekend rate. Travel is a fixed amount per worked day.
Your advice is a suggestion, never an obligation. You may give general tips (spreading hours, overtime, Saturday shifts,
rest, Israeli labor law basics) but say you are not a lawyer or accountant when relevant. Never ask for passwords or ID numbers.
Plain text only, no markdown tables; short lines and simple bullets ("•") are fine.`;

async function signedIn(req) {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: auth } });
  return r.ok;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "no_key" });
  try { if (!(await signedIn(req))) return res.status(401).json({ error: "unauthorized" }); }
  catch (e) { return res.status(502).json({ error: "auth" }); }

  const body = req.body || {};
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-16)
    .map(m => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text || "").slice(0, 1500) }] }))
    .filter(m => m.parts[0].text);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return res.status(400).json({ error: "messages" });
  const context = JSON.stringify(body.context || {}).slice(0, 12000);

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM}\n\nWorker data (JSON):\n${context}` }] },
        contents: msgs,
        generationConfig: { temperature: 0.5, maxOutputTokens: 900 }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "quota" : "model", detail: data.error && data.error.message ? String(data.error.message).slice(0, 200) : "" });
    const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || []).map(p => p.text || "").join("").trim();
    if (!text) return res.status(502).json({ error: "empty" });
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: "network" });
  }
};
