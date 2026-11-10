// NEW PHONE: התראות לטלפון של המנהלים (הזמנה חדשה)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'NEW PHONE', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NEW PHONE', {
      body: data.body || '',
      icon: '/Logo.JPG',
      badge: '/Logo.JPG',
      tag: data.tag || undefined,
      dir: 'rtl',
      lang: 'he',
      requireInteraction: true,
      data: { url: data.url || '/admin/orders' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/orders';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
