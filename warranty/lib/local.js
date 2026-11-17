// נשמר רק במכשיר: הארכיונים שפתחתי
function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export const getVaults = () => read('wr_vaults', []);
export function rememberVault(id, name) {
  const list = getVaults().filter((v) => v.id !== id);
  list.unshift({ id, name, at: Date.now() });
  write('wr_vaults', list.slice(0, 10));
}
export function forgetVault(id) {
  write('wr_vaults', getVaults().filter((v) => v.id !== id));
}
export const getPref = (k, d) => read('wr_pref_' + k, d);
export const setPref = (k, v) => write('wr_pref_' + k, v);
// מוסיף ארכיון לסוף הרשימה (בלי לשנות את הסדר) אם הוא עוד לא שם
export function addVaultIfMissing(id, name) {
  const list = getVaults();
  if (list.some((v) => v.id === id)) return;
  list.push({ id, name, at: Date.now() });
  write('wr_vaults', list.slice(0, 10));
}
