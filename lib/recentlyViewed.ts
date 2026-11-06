// מוצרים שהלקוח צפה בהם לאחרונה (נשמר רק בטלפון של הלקוח)
const KEY = 'np_recently_viewed';
const MAX = 12;

export function getRecentlyViewed(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(id: string) {
  try {
    const list = [id, ...getRecentlyViewed().filter((x) => x !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}
