// חיפוש תמונת מוצר — רץ מהטלפון עצמו (Open Food Facts מאפשר), כדי לא להיחסם כמו שרת משותף.
// אם לא נמצא — השרת מנסה גוגל (אם מוגדר) / Wikimedia.
import { enTermFor } from './parse';

const tm = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

async function offClassic(q) {
  const u = 'https://il.openfoodfacts.org/cgi/search.pl?json=1&page_size=12&fields=product_name,image_front_small_url,image_front_url&search_terms=' + encodeURIComponent(q);
  const r = await fetch(u, { signal: tm(7000) });
  const j = await r.json();
  return (j.products || []).filter((p) => p.image_front_small_url)
    .map((p) => ({ thumb: p.image_front_small_url, url: p.image_front_url || p.image_front_small_url, title: p.product_name || '' }));
}

async function offNew(q) {
  const u = 'https://search.openfoodfacts.org/search?page_size=12&langs=he,en&q=' + encodeURIComponent(q);
  const r = await fetch(u, { signal: tm(6000) });
  const j = await r.json();
  return (j.hits || []).filter((p) => p.image_front_small_url)
    .map((p) => ({ thumb: p.image_front_small_url, url: p.image_front_url || p.image_front_small_url, title: p.product_name || '' }));
}

export async function findImages(name, { productOnly = false } = {}) {
  for (const f of [offClassic, offNew]) {
    try { const r = await f(name); if (r.length) return { images: r.slice(0, 8), source: 'openfoodfacts' }; } catch {}
  }
  if (productOnly) return { images: [], source: '' };
  try {
    const r = await fetch(`/api/image?q=${encodeURIComponent(name)}&en=${encodeURIComponent(enTermFor(name) || '')}`);
    return await r.json();
  } catch { return { images: [], source: '' }; }
}
