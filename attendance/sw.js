// Offline shell: the app's own files come from the network first and fall back to the cache.
const CACHE = "attendance-v5";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname === "unpkg.com") {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("/")))
  );
});

// Background notifications sent by the server (shift end, forgotten shift, boss approval, morning reminder)
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "שעון נוכחות", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "שעון נוכחות", {
    body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || "attendance", renotify: true,
    vibrate: [300, 150, 300], data: { url: "/" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === location.origin);
    return open ? open.focus() : self.clients.openWindow("/");
  }));
});
