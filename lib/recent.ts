// מוצרים שהלקוח צפה בהם לאחרונה. נשמר רק במכשיר של הלקוח (בלי חשבון)
const KEY = 'np_recent';
const MAX = 12;
export const RECENT_EVENT = 'recentUpdated';

export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.map(String).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(id: string) {
  try {
    const list = [String(id), ...getRecent().filter((x) => x !== String(id))].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    // אחסון חסום
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    // אחסון חסום
  }
}
