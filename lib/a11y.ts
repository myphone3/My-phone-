// הגדרות נגישות: נשמרות בטלפון של הלקוח ומופעלות כמחלקות על תגית html
export type A11ySettings = { text: 0 | 1 | 2; contrast: boolean; links: boolean; noMotion: boolean };
export const A11Y_KEY = 'np_a11y';
export const A11Y_DEFAULT: A11ySettings = { text: 0, contrast: false, links: false, noMotion: false };

// ערכים שמורים נבדקים, כדי שערך שגוי לא יציג מצב אחר מזה שמופעל בדף
export function normalizeA11y(raw: any): A11ySettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    text: r.text === 1 || r.text === 2 ? r.text : 0,
    contrast: r.contrast === true,
    links: r.links === true,
    noMotion: r.noMotion === true,
  };
}

export function readA11y(): A11ySettings {
  try {
    return normalizeA11y(JSON.parse(localStorage.getItem(A11Y_KEY) || '{}'));
  } catch {
    return A11Y_DEFAULT;
  }
}

export function applyA11y(s: A11ySettings) {
  const c = document.documentElement.classList;
  c.toggle('a11y-text-1', s.text === 1);
  c.toggle('a11y-text-2', s.text === 2);
  c.toggle('a11y-contrast', s.contrast);
  c.toggle('a11y-links', s.links);
  c.toggle('a11y-no-motion', s.noMotion);
}

// רץ לפני שהדף מוצג, כדי שלא יהיה הבהוב
export const A11Y_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${A11Y_KEY}')||'{}'),c=document.documentElement.classList;if(s.text===1)c.add('a11y-text-1');if(s.text===2)c.add('a11y-text-2');if(s.contrast===true)c.add('a11y-contrast');if(s.links===true)c.add('a11y-links');if(s.noMotion===true)c.add('a11y-no-motion');}catch(e){}`;
