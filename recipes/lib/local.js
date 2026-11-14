// דברים שנשמרים רק במכשיר: איזה מטבח שלי, מזהה המכשיר, העדפות
export function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function write(key, v) {
  try { if (v === null || v === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export const getKitchenId = () => read('rc_kitchen', null);
export const setKitchenId = (id) => write('rc_kitchen', id);

export function deviceId() {
  let id = read('rc_device', null);
  if (!id) { id = Math.random().toString(36).slice(2, 10); write('rc_device', id); }
  return id;
}
