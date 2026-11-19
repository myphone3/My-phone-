// התקנה למסך הבית, פתיחה מיידית (גם בלי אינטרנט), ו"שיתוף" מוואטסאפ ישר לאפליקציה.
// הנתונים עצמם נשמרים בזיכרון של הדף ומתעדכנים מהשרת.
const APP = 'kb-app-v5';
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

// דף: קודם מהרשת (כדי שהשם, הלוגו והאייקון תמיד יהיו מעודכנים), ואם אין אינטרנט או שזה איטי מדי — מהעותק השמור
async function networkFirst(e) {
  const url = new URL(e.request.url);
  url.searchParams.delete('__fresh');
  // אותו דף לכל פרמטר (?add, ?shared…)
  const key = url.origin + url.pathname;
  const cache = await caches.open(APP);
  const net = fetch(e.request).then((res) => { if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone()); return res; });
  const slow = new Promise((r) => setTimeout(r, 4000));
  try {
    const res = await Promise.race([net, slow]);
    if (res) return res;
    const hit = await cache.match(key);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return await net;
  } catch {
    return (await cache.match(key)) || (await cache.match(url.origin + '/')) || Response.error();
  }
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
        e.respondWith(networkFirst(e));
        return;
      }
    }
  }
  // שיתוף: לאפליקציה הכללית (/share-target) או לאפליקציה של חנות מסוימת (/s/<חנות>/share-target)
  const shareShop = url.pathname.match(/^\/s\/([0-9a-f-]{36})\/share-target$/);
  if (req.method === 'POST' && (url.pathname === '/share-target' || shareShop)) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const cache = await caches.open('kb-share');
        for (const k of await cache.keys()) await cache.delete(k);
        const f = form.getAll('files').find((x) => x && typeof x !== 'string');
        if (f) await cache.put('/shared/file', new Response(f, { headers: { 'Content-Type': f.type || 'text/plain', 'X-Name': encodeURIComponent(f.name || 'chat.txt') } }));
        await cache.put('/shared/data', new Response(JSON.stringify({ title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '' })));
      } catch {}
      return Response.redirect((shareShop ? '/s/' + shareShop[1] : '/') + '?shared=1', 303);
    })());
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'מידע לחנות', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'מידע לחנות', {
    body: d.body || '', tag: d.tag, renotify: true, icon: d.icon || '/icon-192.png', badge: '/badge.png',
    dir: 'rtl', lang: 'he', data: { url: d.url || '/' },
    // הודעה דחופה נשארת על המסך עד שנוגעים בה, ועם רטט חזק
    requireInteraction: !!d.urgent, vibrate: d.urgent ? [300, 120, 300, 120, 300] : undefined,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('navigate' in c && 'focus' in c) return c.navigate(url).then((w) => (w || c).focus()); }
    return self.clients.openWindow(url);
  }));
});
