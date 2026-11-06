// רשימת מועדפים (נשמרת בטלפון של הלקוח)
const KEY = 'np_favorites';
export const FAVORITES_EVENT = 'favoritesUpdated';

export function getFavorites(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string').slice(0, 100) : [];
  } catch {
    return [];
  }
}

// מחזיר true אם המוצר נוסף, false אם הוסר
export function toggleFavorite(id: string): boolean {
  const list = getFavorites();
  const adding = !list.includes(id);
  const next = adding ? [id, ...list] : list.filter((x) => x !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  return adding;
}
