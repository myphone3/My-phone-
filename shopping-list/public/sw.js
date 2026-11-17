// מאפשר התקנה למסך הבית והתראות.
// מהירות: קבצי האפליקציה ותמונות המוצרים נשמרים בטלפון, כך שהפתיחה מיידית.
// הרשימה עצמה תמיד מגיעה מהשרת (ובזמן אמת) — האפליקציה מציגה קודם את מה שזכרה ומעדכנת.
const APP = 'sl-app-v1';  // דפים וקבצי האפליקציה
const IMG = 'sl-img-v1';  // תמונות מוצרים
const KEEP = [APP, IMG];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

// שומר רק את 500 התמונות האחרונות
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// תמונת מוצר מאתר אחר: מנסים להביא אותה בצורה שאפשר לשמור; אם האתר לא מרשה — מציגים בלי לשמור
async function image(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }));
    if (res.ok) { cache.put(req.url, res.clone()); trim(cache, 500); return res; }
  } catch {}
  return fetch(req);
}

// דף: מציגים מיד את הגרסה השמורה, ומעדכנים אותה ברקע לפעם הבאה.
// ?__fresh= מגיע מהדף אם קובץ של גרסה ישנה כבר לא קיים — אז לוקחים מהרשת.
async function page(e) {
  const url = new URL(e.request.url);
  const fresh = url.searchParams.has('__fresh');
  url.searchParams.delete('__fresh');
  url.searchParams.delete('all');
  const key = url.toString();
  const cache = await caches.open(APP);
  const net = fetch(e.request).then((res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  if (!fresh) {
    const hit = await cache.match(key);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  }
  try { return await net; } catch { return (await cache.match(key, { ignoreSearch: true })) || (await cache.match(new URL('/', url).toString())) || Response.error(); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api')) return;
    if (url.pathname.startsWith('/_next/static/') || /^\/(icon|apple-touch-icon)[\w-]*\.(png|svg)$/.test(url.pathname)) {
      e.respondWith(cacheFirst(req, APP).catch(() => fetch(req)));
      return;
    }
    if (req.mode === 'navigate' && !req.headers.get('RSC')) { e.respondWith(page(e)); return; }
    return;
  }
  if (req.destination === 'image' && url.protocol === 'https:') e.respondWith(image(req));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'רשימת קניות', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'רשימת קניות', {
    body: d.body || '', tag: d.tag, renotify: true, icon: '/icon-192.png?v=4', badge: '/icon-192.png?v=4',
    dir: 'rtl', lang: 'he', data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
