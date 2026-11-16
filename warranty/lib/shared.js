// קבצים ששותפו לאפליקציה (מהגלריה / מהמייל) — ה-service worker שומר אותם, וכאן הופכים אותם בחזרה לקבצים
export async function takeSharedFiles() {
  try {
    if (!('caches' in window)) return [];
    const cache = await caches.open('wr-share');
    const keys = await cache.keys();
    const files = [];
    for (const k of keys) {
      const r = await cache.match(k);
      if (!r) continue;
      const blob = await r.blob();
      const name = decodeURIComponent(r.headers.get('X-Name') || 'file');
      files.push(new File([blob], name, { type: blob.type || r.headers.get('Content-Type') || '' }));
      await cache.delete(k);
    }
    return files;
  } catch {
    return [];
  }
}
