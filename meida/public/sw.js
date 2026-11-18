// התקנה למסך הבית, פתיחה מיידית (גם בלי אינטרנט), ו"שיתוף" מוואטסאפ ישר לאפליקציה.
// הנתונים עצמם נשמרים בזיכרון של הדף ומתעדכנים מהשרת.
const APP = 'kb-app-v1';
const IMG = 'kb-img-v1';
const KEEP = [APP, IMG, 'kb-share'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, name, fetchReq) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(fetchReq || req);
  if (res.ok) { cache.put(req, res.clone()); if (name === IMG) trim(cache, 300); }
  return res;
}

async function staleWhileRevalidate(e) {
  const url = new URL(e.request.url);
  const fresh = url.searchParams.has('__fresh');
  url.searchParams.delete('__fresh');
  // אותו דף לכל פרמטר (?add, ?shared…)
  const key = url.origin + url.pathname;
  const cache = await caches.open(APP);
  const net = fetch(e.request).then((res) => { if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone()); return res; });
  if (!fresh) {
    const hit = await cache.match(key);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  }
  try { return await net; } catch { return (await cache.match(key)) || (await cache.match(url.origin + '/')) || Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.includes('/storage/v1/object/public/kb-photos/')) {
      e.respondWith(cacheFirst(req, IMG, new Request(req.url, { mode: 'cors', credentials: 'omit' })).catch(() => fetch(req)));
      return;
    }
    if (url.origin === location.origin) {
      if (url.pathname.startsWith('/_next/static/') || /^\/(icon|apple-touch-icon)[\w-]*\.png$/.test(url.pathname)) {
        e.respondWith(cacheFirst(req, APP));
        return;
      }
      if (req.mode === 'navigate' && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/auth') && !req.headers.get('RSC')) {
        e.respondWith(staleWhileRevalidate(e));
        return;
      }
    }
  }
  if (req.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const cache = await caches.open('kb-share');
        for (const k of await cache.keys()) await cache.delete(k);
        const f = form.getAll('files').find((x) => x && typeof x !== 'string');
        if (f) await cache.put('/shared/file', new Response(f, { headers: { 'Content-Type': f.type || 'text/plain', 'X-Name': encodeURIComponent(f.name || 'chat.txt') } }));
        await cache.put('/shared/data', new Response(JSON.stringify({ title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '' })));
      } catch {}
      return Response.redirect('/?shared=1', 303);
    })());
  }
});
