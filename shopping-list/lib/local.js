// דברים שנשמרים רק במכשיר: השם שלי והרשימות שפתחתי
function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export const getMyName = () => read('sl_name', '');
export const setMyName = (n) => write('sl_name', n);

export const getMyLists = () => read('sl_lists', []);
export function rememberList(id, name) {
  const lists = getMyLists().filter((l) => l.id !== id);
  lists.unshift({ id, name, at: Date.now() });
  write('sl_lists', lists.slice(0, 20));
}
export function forgetList(id) {
  write('sl_lists', getMyLists().filter((l) => l.id !== id));
}

export const getPref = (k, d) => read('sl_pref_' + k, d);
export const setPref = (k, v) => write('sl_pref_' + k, v);
