'use client';
// המתכונים נשמרים במכשיר: נטענים מיד מהזיכרון, ומתעדכנים כשיש אינטרנט
import { read, write } from './local';
import { thumbOf } from './thumbs';

export const cachedKitchen = (id) => (id ? read('rc_data_' + id, null) : null);

export function storeKitchen(id, data) {
  if (!id || !data) return;
  write('rc_data_' + id, data);
  try {
    const urls = [];
    for (const r of data.recipes || []) {
      if (r.image_url) { urls.push(r.image_url); const t = thumbOf(r.image_url); if (t) urls.push(t); }
      for (const u of r.source_images || []) urls.push(u);
      for (const u of r.gallery || []) urls.push(u);
    }
    for (const m of data.kitchen?.music || []) if (m.videoId) urls.push(`https://i.ytimg.com/vi/${m.videoId}/mqdefault.jpg`);
    const send = () => navigator.serviceWorker?.controller?.postMessage({ type: 'cache-images', urls: [...new Set(urls)] });
    if (navigator.serviceWorker?.controller) send();
    else navigator.serviceWorker?.ready.then(() => setTimeout(send, 1500));
  } catch {}
}

export function useOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}
