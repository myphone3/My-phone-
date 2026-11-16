// מאפשר התקנה למסך הבית, התראות, ו"שיתוף" של תמונה/PDF מהגלריה או מהמייל ישר לאפליקציה.
// לא שומר דפים במטמון כדי שהמידע תמיד יהיה עדכני.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
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
