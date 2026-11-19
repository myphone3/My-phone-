// לוגו של חברה לפי האתר שלה (האייקון של האתר, באיכות גבוהה). מוחזר מאותו אתר, כדי שהדפדפן יוכל לשמור אותו.
export const runtime = 'nodejs';

export async function GET(req) {
  const d = String(new URL(req.url).searchParams.get('d') || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) || d.length > 80) return new Response('bad', { status: 400 });
  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=256`, { signal: AbortSignal.timeout(8000) });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return new Response('none', { status: 404 });
    const buf = await r.arrayBuffer();
    // אייקון ברירת מחדל (גלובוס קטן) = אין לוגו לאתר הזה
    if (buf.byteLength < 400) return new Response('none', { status: 404 });
    return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
  } catch {
    return new Response('none', { status: 502 });
  }
}
