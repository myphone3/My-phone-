// חיפוש מוזיקה ביוטיוב מתוך האפליקציה
import { searchYouTube } from '@/lib/ytsearch';

export const runtime = 'nodejs';

const cache = new Map();

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').trim().slice(0, 100);
  const kind = ['all', 'playlist', 'video'].includes(searchParams.get('kind')) ? searchParams.get('kind') : 'all';
  if (!q) return Response.json({ results: [] });
  const key = kind + ':' + q;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return Response.json({ results: hit.results });
  try {
    const results = await searchYouTube(q, kind);
    if (cache.size > 300) cache.clear();
    cache.set(key, { at: Date.now(), results });
    return Response.json({ results });
  } catch {
    return Response.json({ results: [], error: 'החיפוש לא זמין כרגע' }, { status: 502 });
  }
}
