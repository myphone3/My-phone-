// ציורים למוצרים ברשימה — במקום אימוג'י כללי.
// הציור נבחר לפי שם המוצר: צבע (פלפל כתום → כתום), יחיד/רבים (עגבניה → אחת, עגבניות → כמה),
// וסוג (פלפל חריף, אשכול עגבניות, פטריות שמפיניון...). אם אין התאמה — חוזרים לאימוג'י.

import { P, D } from './draw/produce';
import { PD, PRODUCT_ENTRIES } from './draw/products';


// איך מציירים "כמה": אשכול של שלושה, או מניפה של דברים מוארכים
const GROUP = { carrot: 'fan', cucumber: 'fan', zucchini: 'fan', banana: 'fan', sweetPotato: 'fan', corn: 'fan', chili: 'fan', greenOnion: 'none', herbs: 'none', grapes: 'none', dates: 'none', celery: 'none', vine: 'none', cherry: 'none', peas: 'fan' };

function group(key, parts) {
  const [a, b, c] = parts;
  if (GROUP[key] === 'fan')
    return `<g transform="translate(-3 4) rotate(-22 32 32) scale(.82)" opacity=".95">${b}</g><g transform="translate(7 2) rotate(20 32 32) scale(.82)">${c}</g><g transform="translate(5 7) scale(.82)">${a}</g>`;
  return `<g transform="translate(-1 3) scale(.6)">${b}</g><g transform="translate(26 3) scale(.6)">${c}</g><g transform="translate(12.5 24) scale(.6)">${a}</g>`;
}

// ─── זיהוי לפי השם ───
const COLOR_WORDS = {
  red: ['אדום', 'אדומה', 'אדומים', 'אדומות'],
  orange: ['כתום', 'כתומה', 'כתומים', 'כתומות'],
  yellow: ['צהוב', 'צהובה', 'צהובים', 'צהובות'],
  green: ['ירוק', 'ירוקה', 'ירוקים', 'ירוקות'],
  purple: ['סגול', 'סגולה', 'סגולים', 'סגולות', 'שחור', 'שחורה', 'שחורים', 'שחורות'],
  white: ['לבן', 'לבנה', 'לבנים', 'לבנות'],
  brown: ['חום', 'חומה', 'חומים', 'חומות'],
};
function colorOf(tokens) {
  for (const t of tokens) for (const [c, ws] of Object.entries(COLOR_WORDS)) if (ws.includes(t)) return c;
  return null;
}

// כל שורה: מפתח ציור, מילים ביחיד, מילים ברבים (וגם צירופים של כמה מילים)
const ENTRIES = [
  ['vine', [], ['אשכול עגבניות', 'עגבניות אשכול', 'עגבניות על הענף', 'עגבניות ענף', 'עגבניות באשכול']],
  ['cherry', [], ['עגבניות שרי', 'עגבניית שרי', 'שרי']],
  ['tomato', ['עגבניה', 'עגבנייה', 'עגבנית'], ['עגבניות', 'עגבניות תמר']],
  ['chili', ['פלפל חריף', "צ'ילי", 'צילי', 'חלפיניו', 'חלפניו', 'חריף'], ['פלפלים חריפים', 'חריפים']],
  ['bellPepper', ['פלפל', 'גמבה'], ['פלפלים', 'גמבות']],
  ['mushroom', ['פטריה', 'פטרייה'], ['פטריות', 'שמפיניון', 'פורטבלו', 'פורטובלו', 'שיטאקי']],
  ['greenOnion', ['בצל ירוק', 'בצלצל'], []],
  ['onion', ['בצל'], ['בצלים']],
  ['garlic', ['שום'], ['ראשי שום']],
  ['potato', ['תפוח אדמה'], ['תפוחי אדמה', 'תפו"א', 'תפוא', 'תפודים', 'תפוד']],
  ['sweetPotato', ['בטטה'], ['בטטות']],
  ['carrot', [], ['גזר', 'גזרים']],
  ['cucumber', ['מלפפון'], ['מלפפונים']],
  ['zucchini', ['קישוא'], ['קישואים']],
  ['eggplant', ['חציל'], ['חצילים']],
  ['cauliflower', ['כרובית'], []],
  ['cabbage', ['כרוב'], []],
  ['broccoli', ['ברוקולי'], []],
  ['lettuce', ['חסה', 'לבבות חסה', 'לבבות'], []],
  ['corn', ['תירס', 'קלח'], ['קלחי תירס', 'קלחים']],
  ['avocado', ['אבוקדו'], []],
  ['lemon', ['לימון', 'ליים'], ['לימונים']],
  ['apple', ['תפוח', 'תפוח עץ'], ['תפוחים', 'תפוחי עץ']],
  ['banana', ['בננה'], ['בננות']],
  ['clementine', ['קלמנטינה', 'מנדרינה', 'קלמנטינ'], ['קלמנטינות', 'מנדרינות']],
  ['orange', ['תפוז'], ['תפוזים']],
  ['pear', ['אגס'], ['אגסים']],
  ['grapes', [], ['ענבים', 'ענב']],
  ['watermelon', ['אבטיח'], ['אבטיחים']],
  ['melon', ['מלון'], ['מלונים']],
  ['strawberry', ['תות'], ['תותים', 'תותי שדה']],
  ['peach', ['אפרסק', 'נקטרינה'], ['אפרסקים', 'נקטרינות']],
  ['plum', ['שזיף'], ['שזיפים']],
  ['mango', ['מנגו'], []],
  ['pineapple', ['אננס'], []],
  ['kiwi', ['קיווי', 'קיוי'], []],
  ['pomegranate', ['רימון'], ['רימונים']],
  ['herbs', ['פטרוזיליה', 'כוסברה', 'שמיר', 'נענע', 'בזיליקום', 'עשבי תיבול', 'מנטה'], []],
  ['celery', ['סלרי'], []],
  ['beet', ['סלק'], []],
  ['radish', ['צנון', 'צנונית'], ['צנוניות']],
  ['pumpkin', ['דלעת'], []],
  ['ginger', ["ג'ינג'ר", 'גינגר', 'זנגביל'], []],
  ['dates', [], ['תמרים', 'תמר']],
  ['peas', ['אפונה'], []],
];
// לא לצייר ירק כשמדובר במוצר מעובד ממנו
const NOT_FRESH = ['חמוץ', 'חמוצים', 'רסק', 'רוטב', 'קטשופ', 'מיץ', 'קפוא', 'קפואה', 'קפואים', 'שימורים', 'קופסה', 'קופסת', 'אבקת', 'ממרח', 'ריבה', 'מרק', "צ'יפס", 'פירורי', 'גרוס', 'מיובש', 'מיובשים', 'חטיף', 'שמן', 'יוגורט', 'גלידה', 'עוגה', 'טחינה', 'פלפל שחור', 'פלפל לבן', 'פלפל אנגלי'];

// מוצרים ארוזים קודם: בתיקו ("מיץ" מול "תפוז") המוצר המעובד מנצח
const LIST = [];
for (const [rows, prod] of [[PRODUCT_ENTRIES, true], [ENTRIES, false]])
  for (const [key, sing, plur] of rows) {
    for (const w of sing) LIST.push({ w, key, prod, plural: false });
    for (const w of plur) LIST.push({ w, key, prod, plural: true });
  }
LIST.sort((a, b) => b.w.length - a.w.length);

function tokensOf(name) {
  return name.replace(/[״"]/g, '"').split(/[\s,.\-–]+/).filter(Boolean)
    .flatMap((t) => (t.length > 3 && (t[0] === 'ו' || t[0] === 'ה') ? [t, t.slice(1)] : [t]));
}

export function matchDrawing(name) {
  if (!name) return null;
  const n = ' ' + name.replace(/[״"]/g, '"').trim() + ' ';
  const toks = tokensOf(name);
  for (const e of LIST) {
    const hit = e.w.includes(' ') ? n.includes(' ' + e.w + ' ') || n.includes(' ' + e.w) : toks.includes(e.w);
    if (!hit) continue;
    if (!e.prod && NOT_FRESH.some((w) => (w.includes(' ') ? n.includes(' ' + w) : toks.includes(w)))) return null;
    return { key: e.key, prod: e.prod, plural: e.plural || /^(פלפלים|עגבניות)$/.test(e.w), color: colorOf(toks), mixed: /צבעוני|מיקס|מעורב/.test(name) };
  }
  return null;
}

function one(key, color, name) {
  const c = color && P[color];
  switch (key) {
    case 'tomato': return D.tomato(color === 'yellow' ? P.yellow : color === 'orange' ? P.orange : color === 'green' ? P.lime : P.red);
    case 'vine': return D.vine(color === 'yellow' ? P.yellow : P.red, 12, 3);
    case 'cherry': return D.vine(color === 'yellow' ? P.yellow : color === 'orange' ? P.orange : P.red, 8.5, 5);
    case 'bellPepper': return D.bellPepper(c || P.red);
    case 'chili': return D.chili(color === 'green' || /חלפ/.test(name) ? P.green : color === 'yellow' ? P.yellow : color === 'orange' ? P.orange : P.red);
    case 'mushroom': return D.mushroom(color === 'brown' || /פורט|שיטאקי|חומ/.test(name) ? P.brownmush : P.mush);
    case 'onion': return D.onion(color === 'red' || color === 'purple' ? P.redonion : color === 'white' ? P.cream : P.onion);
    case 'potato': return D.potato();
    case 'cabbage': return color === 'red' || color === 'purple' ? D.cabbage({ b: '#8E3B8F', d: '#5B1E5C', l: '#D9A6DA' }) : D.cabbage();
    case 'apple': return D.apple(color === 'green' || /גרנד|סמית/.test(name) ? P.lime : color === 'yellow' || /גולדן/.test(name) ? P.yellow : P.red);
    case 'grapes': return color === 'red' || color === 'purple' ? D.grapes({ b: '#7B3F8F', d: '#4A1A58', l: '#D3A6DE' }) : D.grapes();
    case 'lemon': return D.lemon(/ליים/.test(name) || color === 'green' ? P.lime : P.yellow);
    case 'clementine': return D.orange(P.orange, 0.82);
    case 'plum': return D.peach(P.plum);
    case 'pear': return D.pear(color === 'red' ? { b: '#C0583A', d: '#842E19', l: '#F0A58A' } : color === 'yellow' ? P.yellow : P.pear);
    default: return D[key] ? D[key]() : null;
  }
}

const cache = new Map();
// מחזיר SVG (טקסט) לציור המוצר, או null אם אין ציור מתאים
export function drawingSvg(name) {
  if (cache.has(name)) return cache.get(name);
  const m = matchDrawing(name);
  let inner = null;
  if (m) {
    if (m.prod) {
      const a = PD[m.key] ? PD[m.key]() : null;
      inner = a && m.plural && !['pita', 'cookies'].includes(m.key) ? group(m.key, [a, a, a]) : a;
    } else if (m.key === 'bellPepper' && (m.mixed || (m.plural && !m.color))) {
      inner = group('bellPepper', [D.bellPepper(P.red), D.bellPepper(P.yellow), D.bellPepper(P.orange)]);
    } else {
      const a = one(m.key, m.color, name);
      inner = a && m.plural && GROUP[m.key] !== 'none' ? group(m.key, [a, a, a]) : a;
    }
  }
  const svg = inner ? `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>` : null;
  cache.set(name, svg);
  return svg;
}

export const DRAWING_KEYS = [...Object.keys(D), ...Object.keys(PD)];
