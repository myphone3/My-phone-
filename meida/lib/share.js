// מה ששותף לאפליקציה מוואטסאפ (טקסט או קובץ ייצוא צ'אט) — ה-service worker שומר אותו, וכאן קוראים פעם אחת
export async function takeShared() {
  try {
    const cache = await caches.open('kb-share');
    const res = await cache.match('/shared/data');
    if (!res) return null;
    const meta = await res.json();
    let file = null;
    const f = await cache.match('/shared/file');
    if (f) {
      const blob = await f.blob();
      file = new File([blob], decodeURIComponent(f.headers.get('X-Name') || 'chat.txt'), { type: blob.type });
    }
    for (const k of await cache.keys()) await cache.delete(k);
    const text = [meta.title, meta.text, meta.url].filter(Boolean).join('\n').trim();
    return { text, file };
  } catch { return null; }
}
