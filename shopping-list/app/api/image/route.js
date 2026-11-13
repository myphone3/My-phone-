// חיפוש תמונות לפריט. אם הוגדרו מפתחות של גוגל — חיפוש תמונות גוגל, אחרת Openverse (חינמי, בלי מפתח).
export const runtime = 'edge';

async function google(q) {
  const key = process.env.GOOGLE_API_KEY, cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null;
  const u = `https://www.googleapis.com/customsearch/v1?searchType=image&num=8&safe=active&gl=il&key=${key}&cx=${cx}&q=${encodeURIComponent(q)}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const j = await r.json();
  return (j.items || []).map((i) => ({ thumb: i.image?.thumbnailLink || i.link, url: i.link }));
}

async function openverse(q) {
  const u = `https://api.openverse.org/v1/images/?page_size=8&mature=false&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { 'User-Agent': 'shopping-list-app' } });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.results || []).map((i) => ({ thumb: i.thumbnail || i.url, url: i.url }));
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
      source = 'openverse';
      images = await openverse(en || q);
      if (!images.length && en) images = await openverse(q);
    }
    return Response.json({ images, source }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
  } catch {
    return Response.json({ images: [] });
  }
}
