// זיכרון מקומי של הארכיון: בפתיחה מציגים מיד את מה שהיה בפעם הקודמת, ומעדכנים מהשרת ברקע
const key = (id) => 'wr_cache_' + id;
export function getCached(id) {
  try { const v = localStorage.getItem(key(id)); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function setCached(id, data) {
  try { localStorage.setItem(key(id), JSON.stringify({ vault: data.vault, receipts: data.receipts, at: Date.now() })); } catch {}
}
export function clearCached(id) {
  try { localStorage.removeItem(key(id)); } catch {}
}
// תמונה קטנה לרשימה (נוצרת בהעלאה לצד התמונה הגדולה: abc.jpg ← abc_t.jpg)
export const thumbOf = (u) => (u && /\.jpg$/.test(u) ? u.replace(/\.jpg$/, '_t.jpg') : u);
