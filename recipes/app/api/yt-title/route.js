// שם השיר / הפלייליסט מיוטיוב (בשביל הרשימה השמורה)
export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const v = searchParams.get('v');
  const list = searchParams.get('list');
  const target = v && /^[\w-]{11}$/.test(v) ? `https://www.youtube.com/watch?v=${v}` : list && /^[\w-]+$/.test(list) ? `https://www.youtube.com/playlist?list=${list}` : null;
  if (!target) return Response.json({ title: '' });
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return Response.json({ title: '' });
    const j = await r.json();
    return Response.json({ title: String(j.title || '').slice(0, 120), author: String(j.author_name || '').slice(0, 80) });
  } catch {
    return Response.json({ title: '' });
  }
}
