// מאפשר התקנה למסך הבית. לא שומר במטמון כדי שהמידע תמיד יהיה עדכני.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
