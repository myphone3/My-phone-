// ייבוא מתכון מקישור לאתר מתכונים: קודם מהנתונים המובנים של האתר (JSON-LD), אחרת קריאה חכמה של הטקסט
import { askAI } from '@/lib/ai';
import { PROMPT, clean, str } from '@/lib/recipeAi';

export const runtime = 'nodejs';
export const maxDuration = 60;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

function okUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const h = url.hostname;
    if (h === 'localhost' || /^(\d+\.){3}\d+$/.test(h) || h.includes(':') || h.endsWith('.local') || h.endsWith('.internal')) return null;
    return url;
  } catch { return null; }
}

const minutes = (iso) => {
  const m = String(iso || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const v = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return v || null;
};
const decode = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const imageOf = (img) => (typeof img === 'string' ? img : Array.isArray(img) ? imageOf(img[0]) : img?.url || '');

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  return findRecipe(node['@graph'] || node.mainEntity || null);
}

function fromLd(r) {
  const steps = [];
  const split = (t) => (t.length > 220 ? t.split(/(?<=[.!?])\s+(?=\S)/).reduce((a, x) => { if (a.length && a[a.length - 1].length < 70) a[a.length - 1] += ' ' + x; else a.push(x); return a; }, []) : [t]);
  const pushSec = (title, items) => { const it = items.map((x) => decode(String(x).replace(/\[caption[\s\S]*?\[\/caption\]/g, ' ')).replace(/\[caption[\s\S]*?\[\s*\/?\s*caption\]/g, ' ').replace(/\[[^\]]{0,200}\]/g, ' ').replace(/^אופן הכנה\s*/, '').replace(/\s+/g, ' ').trim()).filter(Boolean).flatMap(split); if (it.length) steps.push({ title, items: it }); };
  const ins = Array.isArray(r.recipeInstructions) ? r.recipeInstructions : r.recipeInstructions ? [r.recipeInstructions] : [];
  let loose = [];
  for (const x of ins) {
    if (typeof x === 'string') loose.push(...x.split(/\n+/));
    else if (x['@type'] === 'HowToSection') { pushSec('', loose); loose = []; pushSec(decode(x.name), (x.itemListElement || []).map((e) => (typeof e === 'string' ? e : e.text || e.name || ''))); }
    else loose.push(x.text || x.name || '');
  }
  pushSec('', loose);
  const yieldN = parseInt(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield, 10);
  return {
    title: decode(r.name).slice(0, 120) || 'מתכון',
    description: decode(r.description).slice(0, 300),
    category: 'אחר',
    servings: isFinite(yieldN) && yieldN > 0 ? yieldN : null,
    prep_minutes: minutes(r.prepTime),
    cook_minutes: minutes(r.cookTime) || (minutes(r.totalTime) && !minutes(r.prepTime) ? minutes(r.totalTime) : null),
    ingredients: [{ title: '', items: (r.recipeIngredient || r.ingredients || []).map(decode).filter(Boolean) }],
    steps,
    tips: [],
    tags: [],
    image: imageOf(r.image),
  };
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad json' }, { status: 400 }); }
  const url = okUrl(String(body.url || '').trim());
  if (!url) return Response.json({ error: 'הקישור לא תקין' }, { status: 400 });
  let html;
  try {
    const r = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(String(r.status));
    html = (await r.text()).slice(0, 3_000_000);
  } catch {
    return Response.json({ error: 'האתר לא מאפשר לקרוא אותו אוטומטית. העתיקו את טקסט המתכון והשתמשו ב״הדבקת טקסט״' }, { status: 502 });
  }

  // 1) נתונים מובנים
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const b of blocks) {
    try {
      const rec = findRecipe(JSON.parse(b.trim()));
      if (rec) {
        const out = fromLd(rec);
        if (out.ingredients[0].items.length && out.steps.length) {
          // סידור עדין עם AI (חלוקה לחלקים, תרגום לעברית, קטגוריה). אם נכשל — משתמשים במה שיש.
          try {
            const ai = await askAI(req, PROMPT + '\n\nמתכון מאתר (JSON):\n' + JSON.stringify({ ...out, image: undefined }).slice(0, 15000));
            const first = Array.isArray(ai?.recipes) && ai.recipes[0];
            if (first) return Response.json({ recipes: [{ ...clean(first, 0), photo: null, image: out.image, source_url: url.href }] });
          } catch (e) { console.error('import ai failed', e?.message || e); }
          return Response.json({ recipes: [{ ...out, source_url: url.href }] });
        }
      }
    } catch {}
  }

  // 2) טקסט חופשי מהדף
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  const text = decode(html.replace(/<(script|style|nav|footer|header|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 16000);
  try {
    const out = await askAI(req, PROMPT + '\n\nטקסט מדף אינטרנט (התעלם מפרסומות ותפריטים):\n' + str(text, 16000));
    const recipes = (Array.isArray(out?.recipes) ? out.recipes : []).slice(0, 3).map((r) => ({ ...clean(r, 0), photo: null, image: og, source_url: url.href }));
    return Response.json({ recipes });
  } catch {
    return Response.json({ error: 'לא הצלחנו לקרוא את המתכון מהאתר' }, { status: 502 });
  }
}
