'use client';
// תמונות מוקטנות לכרטיסים: לכל תמונה באחסון שלנו (abc.jpg) נשמרת גם גרסה קטנה (abc.t.jpg).
// מסך הבית (בטלפון ובטלוויזיה) טוען את הקטנה — פי 5-10 פחות נתונים, נפתח וזז הרבה יותר חלק.
// תמונות ישנות מקבלות גרסה קטנה ברקע, פעם אחת, מהטלפון.
import { supabase } from './supabase';
import { read, write } from './local';

const MARK = '/storage/v1/object/public/rc-photos/';
const SIDE = 560;

export function thumbOf(url) {
  if (!url || typeof url !== 'string' || !url.includes(MARK) || !/\.jpg$/i.test(url) || /\.t\.jpg$/i.test(url)) return null;
  return url.replace(/\.jpg$/i, '.t.jpg');
}
const pathOf = (url) => decodeURIComponent(url.split(MARK)[1] || '');

async function shrink(blob) {
  const u = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const scale = Math.min(1, SIDE / Math.min(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('thumb'))), 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(u); }
}

// אחרי העלאה של תמונה חדשה (כבר יש לנו את הקובץ — לא מורידים שוב)
export async function uploadThumb(fullUrl, blob) {
  const t = thumbOf(fullUrl);
  if (!t) return;
  try {
    const small = await shrink(blob);
    await supabase.storage.from('rc-photos').upload(pathOf(t), small, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  } catch {}
}

// השלמה ברקע לתמונות ישנות (כמה בכל פתיחה, בלי להפריע)
let running = false;
export async function backfillThumbs(recipes) {
  if (running || typeof window === 'undefined' || !navigator.onLine) return;
  running = true;
  try {
    const done = new Set(read('rc_thumbs', []));
    const todo = [...new Set((recipes || []).map((r) => r.image_url).filter((u) => thumbOf(u) && !done.has(u)))].slice(0, 25);
    for (const u of todo) {
      try {
        const head = await fetch(thumbOf(u), { method: 'HEAD', cache: 'no-store' });
        if (!head.ok) {
          const res = await fetch(u, { mode: 'cors', cache: 'no-store' });
          if (!res.ok) continue;
          await uploadThumb(u, await res.blob());
        }
        done.add(u);
        write('rc_thumbs', [...done].slice(-500));
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally { running = false; }
}
