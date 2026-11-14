// חיפוש תמונות לפריט: גוגל (אם יוגדר מנוע חיפוש), אחרת Open Food Facts — מאגר מוצרי מזון עם מוצרים ישראליים
// בחיפוש בעברית — ואם לא נמצא, Wikimedia Commons.
export const runtime = 'edge';

async function google(q) {
  const key = process.env.GOOGLE_API_KEY, cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null;
  const u = `https://www.googleapis.com/customsearch/v1?searchType=image&num=8&safe=active&gl=il&key=${key}&cx=${cx}&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { signal: withTimeout(6000) });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.items || []).map((i) => ({ thumb: i.image?.thumbnailLink || i.link, url: i.link }));
}

function withTimeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// Open Food Facts — תמונות אמיתיות של מוצרים ישראליים, חיפוש בעברית
async function openFoodFacts(q) {
  const u = 'https://il.openfoodfacts.org/cgi/search.pl?json=1&page_size=12&fields=product_name,image_front_small_url,image_front_url' +
    `&search_terms=${encodeURIComponent(q)}`;
  const r = await fetch(u, { signal: withTimeout(6000), headers: { 'User-Agent': 'shopping-list-app/1.0' } });
  if (!r.ok) return [];
  const j = await r.json().catch(() => null);
  return ((j && j.products) || [])
    .filter((p) => p.image_front_small_url)
    .slice(0, 8)
    .map((p) => ({ thumb: p.image_front_small_url, url: p.image_front_url || p.image_front_small_url, title: p.product_name || '' }));
}

// Wikimedia Commons — חינמי, מהיר, בלי מפתח
async function commons(q) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12' +
    `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|mime&iiurlwidth=240`;
  const r = await fetch(u, { signal: withTimeout(6000), headers: { 'User-Agent': 'shopping-list-app/1.0' } });
  if (!r.ok) return [];
  const j = await r.json();
  return Object.values(j.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => p.imageinfo?.[0])
    .filter((i) => i && /image\/(jpeg|png|webp)/.test(i.mime || ''))
    .slice(0, 8)
    .map((i) => ({ thumb: i.thumburl || i.url, url: i.url }));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').slice(0, 80);
  const en = (searchParams.get('en') || '').slice(0, 80);
  if (!q) return Response.json({ images: [] });
  try {
    let images = await google(q);
    let source = 'google';
    if (!images || !images.length) {
      source = 'openfoodfacts';
      images = await openFoodFacts(q).catch(() => []);
      if (!images.length) {
        source = 'commons';
        images = await commons(en || q).catch(() => []);
        if (!images.length && en) images = await commons(q).catch(() => []);
      }
    }
    return Response.json({ images, source }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch {
    return Response.json({ images: [] });
  }
}
