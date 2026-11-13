// מאפשר התקנה למסך הבית. לא שומר במטמון כדי שהרשימה תמיד תהיה עדכנית.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
