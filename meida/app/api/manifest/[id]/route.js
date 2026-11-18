// קובץ התקנה נפרד לכל חנות: אפליקציה משלה במסך הבית, עם הלוגו של החנות כאייקון
import { getBrand, iconUrl, appName, SHOP_ID } from '@/lib/brand';

export async function GET(req, { params }) {
  const id = params.id;
  if (!SHOP_ID.test(id)) return new Response('not found', { status: 404 });
  const b = await getBrand(id);
  if (!b) return Response.redirect(new URL('/manifest.json', req.url), 302);
  const n = appName(b.name);
  const base = `/s/${id}`;
  const any = (s) => ({ src: iconUrl(id, b.logo, s), sizes: `${s}x${s}`, type: 'image/png', purpose: 'any' });
  const manifest = {
    name: n.name,
    short_name: n.short,
    id: base,
    start_url: base,
    scope: base,
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#ffffff',
    theme_color: '#0e7490',
    description: `כל המידע של ${b.name} במקום אחד`,
    icons: [any(192), any(512), { src: iconUrl(id, b.logo, 512, true), sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
    share_target: {
      action: `${base}/share-target`,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'files', accept: ['text/plain', '.txt', 'application/zip', '.zip'] }] },
    },
    shortcuts: [
      { name: 'מידע חדש', short_name: 'חדש', url: `${base}?add`, icons: [{ src: iconUrl(id, b.logo, 192), sizes: '192x192' }] },
      { name: 'שאל את המאגר', short_name: 'שאל', url: `${base}?ask`, icons: [{ src: iconUrl(id, b.logo, 192), sizes: '192x192' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600' },
  });
}
