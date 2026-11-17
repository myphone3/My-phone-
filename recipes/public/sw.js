// שמירת האפליקציה והמתכונים במכשיר — כדי שייפתחו מיד, וגם בלי אינטרנט.
// דפים: מוצגת מיד הגרסה השמורה, והגרסה החדשה נטענת ברקע לפעם הבאה.
const V = 'rc-v4';
const SHELL = ['/', '/tv', '/manifest.json', '/icon.svg', '/icon-192.png', '/fonts/rubik-hebrew.woff2', '/fonts/rubik-latin.woff2'];
const IMG = 'rc-img';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== V && k !== IMG).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isImg = (u) => u.pathname.includes('/storage/v1/object/public/rc-photos/') || u.hostname === 'i.ytimg.com';

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') (await caches.open(name)).put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

// דף: קודם מה ששמור (פתיחה מיידית), ומעדכנים ברקע.
// ?__fresh= מגיע מהדף עצמו אם קובץ של גרסה ישנה כבר לא קיים — אז לוקחים מהרשת.
async function page(e) {
  const req = e.request;
  const url = new URL(req.url);
  const fresh = url.searchParams.has('__fresh');
  url.searchParams.delete('__fresh');
  const key = url.toString();
  const cache = await caches.open(V);
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  if (!fresh) {
    const hit = await cache.match(key);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  }
  try {
    return await net;
  } catch {
    return (await cache.match(key, { ignoreSearch: true })) || (await cache.match(url.pathname.startsWith('/tv') ? '/tv' : '/')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') return e.respondWith(page(e));
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || /\.(png|svg|woff2)$/.test(url.pathname)) return e.respondWith(cacheFirst(req, V));
    return;
  }
  if (isImg(url)) return e.respondWith(cacheFirst(req, IMG));
});

// שמירה מראש של כל תמונות המתכונים
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-images') return;
  const urls = (e.data.urls || []).slice(0, 400);
  e.waitUntil(caches.open(IMG).then(async (c) => {
    for (const u of urls) {
      try { if (!(await c.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r); } } catch {}
    }
  }));
});
