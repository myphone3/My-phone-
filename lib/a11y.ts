// הגדרות נגישות: נשמרות בטלפון של הלקוח ומופעלות כמחלקות על תגית html
export type A11ySettings = { text: 0 | 1 | 2; contrast: boolean; links: boolean; noMotion: boolean };
export const A11Y_KEY = 'np_a11y';
export const A11Y_DEFAULT: A11ySettings = { text: 0, contrast: false, links: false, noMotion: false };

export function readA11y(): A11ySettings {
  try {
    return { ...A11Y_DEFAULT, ...JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') };
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
export const A11Y_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${A11Y_KEY}')||'{}'),c=document.documentElement.classList;if(s.text===1)c.add('a11y-text-1');if(s.text===2)c.add('a11y-text-2');if(s.contrast)c.add('a11y-contrast');if(s.links)c.add('a11y-links');if(s.noMotion)c.add('a11y-no-motion');}catch(e){}`;
