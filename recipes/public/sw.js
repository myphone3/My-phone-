// מאפשר התקנה למסך הבית. לא שומר במטמון כדי שהמתכונים תמיד יהיו עדכניים.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
