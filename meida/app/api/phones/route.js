// כל הפלאפונים הכשרים ותומכי הכשר מהאתר של כשר פון (kosher-phone.com), כדי שדגם חדש באתר יופיע לבד ב"מקש לגירסה".
// נשמר במטמון ליום. מחזיר [{ id, name, brand, kind: kosher|ready, img }]
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://kosher-phone.com';
const CATS = [['מכשירים כשרים', 'kosher'], ['מכשירים תומך כשר', 'ready']];

// "מכשיר כשר ועדת הרבנים Q7" → "Q7"
function shortName(n) {
  return String(n || '')
    .replace(/\s+[–|-]\s+.*$/, '')
    .replace(/מכשיר כשר ועדת הרבנים|טלפון כשר|פלאפון תומך כשר|פלאפון|מכשיר|תומך כשר|דגם|4G|\d+\s?GB|\d+\s?GB RAM|RAM/gi, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 60) || String(n || '').slice(0, 60);
}

export async function GET() {
  try {
    const out = [];
    for (const [cat, kind] of CATS) {
      const u = `${SITE}/api/products?limit=200&category=${encodeURIComponent(cat)}`;
      const r = await fetch(u, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
      if (!r.ok) throw new Error('site ' + r.status);
      const j = await r.json();
      for (const p of j.products || []) {
        if (!p?.id) continue;
        const img = p.images?.[0]?.url || '';
        const brand = String((typeof p.brand === 'object' ? p.brand?.name : p.brand) || '').split(' - ')[0].trim();
        out.push({ id: 'kp-' + p.id, name: shortName(p.name), brand, kind, img: img.startsWith('/') ? SITE + img : img });
      }
    }
    return Response.json(out, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
  } catch {
    return Response.json([], { status: 502 });
  }
}
