// זיכרון מקומי: בפתיחה מציגים מיד את מה שהיה בפעם הקודמת (גם בלי אינטרנט), ומעדכנים מהשרת ברקע
const key = (id) => 'kb_cache_' + id;
export function getCached(id) {
  try { const v = localStorage.getItem(key(id)); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function setCached(id, data) {
  try { localStorage.setItem(key(id), JSON.stringify(data)); } catch {}
}
export function clearCached(id) {
  try { localStorage.removeItem(key(id)); } catch {}
}
export function lastShop() { try { return localStorage.getItem('kb_last_shop') || ''; } catch { return ''; } }
export function setLastShop(id) { try { id ? localStorage.setItem('kb_last_shop', id) : localStorage.removeItem('kb_last_shop'); } catch {} }

// חיפושים אחרונים ופריטים שנפתחו לאחרונה (בטלפון הזה בלבד)
export function getList(name) { try { return JSON.parse(localStorage.getItem('kb_' + name) || '[]'); } catch { return []; } }
export function pushList(name, v, max = 12) {
  const l = [v, ...getList(name).filter((x) => x !== v)].slice(0, max);
  try { localStorage.setItem('kb_' + name, JSON.stringify(l)); } catch {}
  return l;
}
