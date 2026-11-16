// הגדרות שנשמרות בטלפון הזה בלבד
import { getPref, setPref } from './local';

export const SETTINGS = {
  notify: { label: 'התראה לפני שהאחריות נגמרת', def: false },
  stats: { label: 'סיכום הוצאות', def: false },
  lock: { label: 'נעילה בקוד / טביעת אצבע', def: false },
  enhance: { label: 'שיפור אוטומטי לתמונות קבלה', def: false },
};
export const getSetting = (k) => getPref('set_' + k, SETTINGS[k]?.def ?? false);
export const setSetting = (k, v) => setPref('set_' + k, v);
