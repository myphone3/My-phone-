// רשימת השוואת מכשירים (עד 3, נשמר בטלפון של הלקוח)
const KEY = 'np_compare';
export const COMPARE_MAX = 3;
export const COMPARE_EVENT = 'compareUpdated';

export function getCompare(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string').slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(COMPARE_EVENT));
}

// מחזיר false אם הרשימה מלאה
export function toggleCompare(id: string): boolean {
  const list = getCompare();
  if (list.includes(id)) {
    save(list.filter((x) => x !== id));
    return true;
  }
  if (list.length >= COMPARE_MAX) return false;
  save([...list, id]);
  return true;
}

export function removeFromCompare(id: string) {
  save(getCompare().filter((x) => x !== id));
}

export function clearCompare() {
  save([]);
}
