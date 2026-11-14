// עזרים למתכון: שלבים ברצף, הגדלת כמויות, זיהוי זמנים ומצרכים בכל שלב

export const CATEGORIES = ['ארוחות', 'בשר ועוף', 'דגים', 'חלבי', 'פשטידות', 'מרקים', 'סלטים', 'תוספות', 'לחמים ומאפים', 'עוגות', 'עוגיות', 'קינוחים', 'שבת וחג', 'אחר'];

export const groups = (list) => (Array.isArray(list) ? list : []).map((g) => ({
  title: g?.title || '',
  items: (Array.isArray(g?.items) ? g.items : []).map((x) => String(x || '').trim()).filter(Boolean),
})).filter((g) => g.items.length || g.title);

// כל השלבים בשורה אחת, עם שם החלק
export function flatSteps(recipe) {
  const out = [];
  groups(recipe?.steps).forEach((g, gi) => {
    g.items.forEach((text, i) => out.push({ text, section: g.title, sectionIndex: gi, inSection: i, sectionSize: g.items.length, index: out.length }));
  });
  return out;
}

export function totalMinutes(r) {
  const t = (Number(r?.prep_minutes) || 0) + (Number(r?.cook_minutes) || 0);
  return t || null;
}

export function fmtMinutes(m) {
  m = Math.round(Number(m) || 0);
  if (!m) return '';
  if (m < 60) return `${m} דק'`;
  const h = Math.floor(m / 60), r = m % 60;
  const hs = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  return r ? `${hs} ו-${r} דק'` : hs;
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ---- הגדלה/הקטנה של כמויות ----
const FRAC = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
const NUM = '(\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[½⅓⅔¼¾⅛])';
const LEAD = new RegExp('^\\s*' + NUM + '(?:\\s*[-–]\\s*' + NUM + ')?');

function toNum(s) {
  s = s.trim();
  if (FRAC[s] !== undefined) return FRAC[s];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + mixed[2] / mixed[3];
  const fr = s.match(/^(\d+)\/(\d+)$/);
  if (fr) return fr[1] / fr[2];
  return parseFloat(s.replace(',', '.'));
}

export function fmtNum(n) {
  if (!isFinite(n)) return '';
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const marks = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  for (const [v, m] of marks) {
    if (Math.abs(rest - v) < 0.04) {
      const w = v === 1 ? whole + 1 : whole;
      if (!m) return String(w);
      return w ? `${w}${m}` : m;
    }
  }
  return String(Math.round(n * 10) / 10);
}

const WORDS = [[/^חצי\s/, 0.5], [/^רבע\s/, 0.25], [/^שליש\s/, 1 / 3]];

export function scaleText(text, factor) {
  if (!factor || Math.abs(factor - 1) < 0.001) return text;
  const m = text.match(LEAD);
  if (m) {
    const a = fmtNum(toNum(m[1]) * factor);
    const b = m[2] ? '-' + fmtNum(toNum(m[2]) * factor) : '';
    return a + b + text.slice(m[0].length);
  }
  for (const [re, v] of WORDS) if (re.test(text)) return fmtNum(v * factor) + ' ' + text.replace(re, '');
  return text;
}

// ---- זיהוי זמן בשלב (לטיימר) ----
export function detectMinutes(text) {
  const t = String(text || '');
  const rules = [
    [/שעה\s*ו?חצי/, () => 90],
    [/שעתיים\s*ו?חצי/, () => 150],
    [/(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[.,]\d+)?)\s*)?שעות/, (m) => parseFloat(m[1]) * 60],
    [/שעתיים/, () => 120],
    [/חצי\s*שעה/, () => 30],
    [/רבע\s*שעה/, () => 15],
    [/(\d+)\s*(?:[-–]\s*(\d+)\s*)?(?:דקות|דקה|דק['׳]?)/, (m) => +m[1]],
    [/(?:^|\s)כ?שעה(?:\s|$|[,.])/, () => 60],
  ];
  for (const [re, f] of rules) {
    const m = t.match(re);
    if (m) {
      const v = Math.round(f(m));
      if (v > 0 && v <= 24 * 60) return v;
    }
  }
  return null;
}

// ---- המצרכים שמוזכרים בשלב ----
const UNITS = new Set('כוס כוסות כף כפות כפית כפיות גרם ג גר ק"ג קילו קג מ"ל מל ליטר ליטרים יחידה יחידות חבילה חבילות שקית שקיות קורט מעט פחית פחיות צרור צרורות שן שיני שיניים ענף ענפים פרוסה פרוסות קופסה קופסת קופסאות בינוני בינונית בינוניים גדול גדולה גדולים גדולות קטן קטנה קטנים קטנות כ חופן מלא מלאה טרי טרייה טריים'.split(' '));
const STOP = new Set('של או עם בלי לפי טעם רצוי אופציונלי'.split(' '));

export function ingredientName(item) {
  const words = String(item).replace(LEAD, '').replace(/\(.*?\)/g, ' ').replace(/[,.:;]/g, ' ').split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !UNITS.has(w.replace(/['׳"]/g, '')) && !UNITS.has(w) && !STOP.has(w) && !/^\d/.test(w));
  return keep[0] || '';
}

export function ingredientsForStep(recipe, stepText) {
  const t = String(stepText || '');
  const out = [];
  groups(recipe?.ingredients).forEach((g, gi) => g.items.forEach((item, i) => {
    const name = ingredientName(item);
    if (name.length >= 2 && t.includes(name.length > 4 ? name.slice(0, name.length - 1) : name)) out.push({ key: `${gi}-${i}`, item });
  }));
  return out.slice(0, 8);
}

export function emptyRecipe() {
  return { title: '', description: '', category: '', tags: [], servings: null, prep_minutes: null, cook_minutes: null, image_url: '', source_images: [], ingredients: [{ title: '', items: [] }], steps: [{ title: '', items: [] }], tips: [], favorite: false };
}
