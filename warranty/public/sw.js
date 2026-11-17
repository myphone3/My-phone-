// מאפשר התקנה למסך הבית, התראות, ו"שיתוף" של תמונה/PDF מהגלריה או מהמייל ישר לאפליקציה.
// מהירות: קבצי האפליקציה ותמונות הקבלות נשמרים בטלפון, כך שהפתיחה מיידית (גם בלי אינטרנט).
// הנתונים עצמם (הקבלות) תמיד מגיעים מהשרת — האפליקציה מציגה קודם את מה שזכרה ומעדכנת.
const APP = 'wr-app-v1';      // דפים וקבצי האפליקציה
const IMG = 'wr-img-v1';      // תמונות קבלות ומוצרים (שמות אקראיים — לא משתנים לעולם)
const KEEP = [APP, IMG, 'wr-share'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

// שומר רק את 400 התמונות האחרונות
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, name, fetchReq) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(fetchReq || req);
  if (res.ok) { cache.put(req, res.clone()); if (name === IMG) trim(cache, 400); }
  return res;
}

// דף: מציגים מיד את הגרסה השמורה, ומעדכנים אותה ברקע לפעם הבאה
async function staleWhileRevalidate(e) {
  const cache = await caches.open(APP);
  const hit = await cache.match(e.request, { ignoreSearch: false });
  const net = fetch(e.request).then((res) => { if (res.ok && res.type === 'basic') cache.put(e.request, res.clone()); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  try { return await net; } catch { return (await cache.match('/', { ignoreSearch: true })) || Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'GET') {
    // תמונות מהאחסון (לא PDF)
    if (/\.supabase\.co$/.test(url.hostname) && url.pathname.includes('/storage/v1/object/public/wr-photos/') && /\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) {
      e.respondWith(cacheFirst(req, IMG, new Request(req.url, { mode: 'cors', credentials: 'omit' })).catch(() => fetch(req)));
      return;
    }
    if (url.origin === location.origin) {
      if (url.pathname.startsWith('/_next/static/') || /^\/(icon|apple-touch-icon)[\w-]*\.png$/.test(url.pathname)) {
        e.respondWith(cacheFirst(req, APP));
        return;
      }
      // מעבר בין דפים: הדף נשמר (בלי /api, /auth, ובלי בקשות פנימיות של Next)
      if (req.mode === 'navigate' && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/auth') && !req.headers.get('RSC')) {
        e.respondWith(staleWhileRevalidate(e));
        return;
      }
    }
  }
  if (e.request.method === 'POST' && url.pathname === '/share-target') {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('files').filter((f) => f && typeof f !== 'string').slice(0, 6);
        const cache = await caches.open('wr-share');
        for (const k of await cache.keys()) await cache.delete(k);
        let i = 0;
        for (const f of files) {
          await cache.put(`/shared/${i++}`, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name || 'file') } }));
        }
      } catch {}
      return Response.redirect('/?shared=1', 303);
    })());
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'קבלות ואחריות', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'קבלות ואחריות', {
    body: d.body || '', tag: d.tag, renotify: true, icon: '/icon-192.png', badge: '/icon-192.png',
    dir: 'rtl', lang: 'he', data: { url: d.url || '/' },
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
