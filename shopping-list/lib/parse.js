import { classify, CAT_EMOJI, DICT } from './catalog';

// מספרים בעברית שאנשים כותבים ברשימות
const WORD_NUM = {
  'אחד': 1, 'אחת': 1, 'שניים': 2, 'שתיים': 2, 'שני': 2, 'שתי': 2, 'זוג': 2,
  'שלוש': 3, 'שלושה': 3, 'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5,
  'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7, 'שמונה': 8, 'תשע': 9, 'תשעה': 9,
  'עשר': 10, 'עשרה': 10, 'חצי': 0.5, 'תריסר': 12,
};

// יחידות: הצורה שכותבים → איך מציגים
const UNITS = [
  [/^(ק"ג|קג|קילו|קילוגרם|kg)$/i, 'ק"ג'],
  [/^(גרם|גר|גר')$/, 'גרם'],
  [/^(ליטר|ל'|ליטרים)$/, 'ליטר'],
  [/^(מ"ל|מל)$/i, 'מ"ל'],
  [/^(חבילות|חבילה|חבילת|חב'|מארז|מארזים)$/, 'חבילות'],
  [/^(בקבוקים|בקבוק|בקבוקי)$/, 'בקבוקים'],
  [/^(קופסאות|קופסא|קופסה|קופסת|קופסאת)$/, 'קופסאות'],
  [/^(שקיות|שקית|שקית של)$/, 'שקיות'],
  [/^(מגשים|מגש|מגשי)$/, 'מגשים'],
  [/^(יחידות|יחידה|יח'|יח)$/, ''],
  [/^(שישיות|שישייה|שישיה|שישית)$/, 'שישיות'],
  [/^(צנצנות|צנצנת)$/, 'צנצנות'],
  [/^(גביעים|גביע)$/, 'גביעים'],
  [/^(קרטון|קרטונים)$/, 'קרטונים'],
];

function unitOf(word) {
  if (!word) return null;
  const w = word.replace(/[״]/g, '"');
  for (const [re, u] of UNITS) if (re.test(w)) return u;
  return null;
}

function numOf(word) {
  if (!word) return null;
  const w = word.replace(/^[xX×*]/, '').replace(/[xX×*]$/, '');
  if (/^\d+([.,]\d+)?$/.test(w)) return parseFloat(w.replace(',', '.'));
  if (WORD_NUM[word] != null) return WORD_NUM[word];
  return null;
}

// מנקה שורה שהועתקה מוואטסאפ: תאריך, שם השולח, תבליטים, וי
function cleanLine(line) {
  let s = line.trim();
  const stamp = /^\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s*\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\]?\s*[-–]?\s*/i;
  if (stamp.test(s)) {
    s = s.replace(stamp, '').replace(/^[^:\n]{1,30}:\s+/, ''); // "[13/11, 10:12] אשתי: חלב"
  }
  s = s.replace(/^[\s\-–—•*·▪️◾️▫️✔️✅☑️☐□○●◦>+]+/u, '');
  s = s.replace(/^\d{1,2}[.)]\s+/, ''); // "1. חלב"
  s = s.replace(/^\[\s?[xX ]?\s?\]\s*/, '');
  return s.trim();
}

export function parseLine(raw) {
  let s = cleanLine(raw);
  if (!s || s.length < 2) return null;
  if (/^(<.*הושמטה>|.*media omitted.*|הודעה זו נמחקה)$/i.test(s)) return null;

  let note = '';
  const paren = s.match(/\(([^)]*)\)/);
  if (paren) { note = paren[1].trim(); s = s.replace(paren[0], ' '); }
  const dash = s.match(/\s[-–—]\s(.+)$/);
  if (dash && !/^\d/.test(dash[1])) { note = [note, dash[1].trim()].filter(Boolean).join(', '); s = s.slice(0, dash.index); }

  let words = s.split(/\s+/).filter(Boolean);
  let qty = null, unit = null;

  // בהתחלה: "2 חלב" / "2 ק"ג עגבניות" / "שני חלב" / "x2 חלב"
  const n0 = numOf(words[0]);
  if (n0 != null && words.length > 1) {
    qty = n0; words.shift();
    const u = unitOf(words[0]);
    if (u != null && words.length > 1) { unit = u; words.shift(); }
  } else {
    const u0 = unitOf(words[0]);
    if (u0 != null && words.length > 1 && u0 !== '') { unit = u0; qty = 1; words.shift(); }
  }
  // בסוף: "חלב 2" / "חלב x3" / "עגבניות 2 קילו" / "חלב 3 יח"
  if (qty == null && words.length > 1) {
    const last = words[words.length - 1];
    const u = unitOf(last);
    if (u != null && words.length > 2 && numOf(words[words.length - 2]) != null) {
      unit = u; words.pop(); qty = numOf(words.pop());
    } else if (numOf(last) != null && /\d|[xX×]/.test(last)) {
      qty = numOf(words.pop());
    } else if (u != null && u !== '' && words.length > 1) {
      unit = u; words.pop(); qty = 1;
    }
  }
  if (unit === '') unit = null;

  let name = words.join(' ').replace(/[,;.!]+$/, '').replace(/^של\s+/, '').trim();
  if (!name) return null;
  if (name.length > 60) { note = [note, name.slice(60)].filter(Boolean).join(' '); name = name.slice(0, 60); }

  const hit = classify(name);
  const category = hit ? hit.category : 'אחר';
  return {
    name,
    qty: qty && qty > 0 ? qty : 1,
    unit,
    note: note || null,
    category,
    emoji: hit ? hit.emoji : CAT_EMOJI[category],
    en: hit ? hit.en : null,
  };
}

// טקסט חופשי (גם כמה פריטים בשורה מופרדים בפסיק) → רשימה מסודרת בלי כפילויות
export function parseText(text) {
  const lines = text
    .split(/\r?\n/)
    .flatMap((l) => {
      const c = cleanLine(l);
      // "חלב, לחם, ביצים" — פיצול לפי פסיק כשאין מספר עשרוני
      return /,|،|\s\+\s/.test(c) && !/\d,\d/.test(c) ? c.split(/\s*(?:,|،|\s\+\s)\s*/) : [c];
    });
  const out = [];
  const byKey = new Map();
  for (const l of lines) {
    const it = parseLine(l);
    if (!it) continue;
    const key = it.name.toLowerCase();
    if (byKey.has(key)) {
      const prev = byKey.get(key);
      if (prev.unit === it.unit) prev.qty += it.qty;
      if (it.note) prev.note = [prev.note, it.note].filter(Boolean).join(', ');
    } else {
      byKey.set(key, it);
      out.push(it);
    }
  }
  return out;
}

export function enTermFor(name) {
  const hit = classify(name);
  return hit ? hit.en : null;
}

export function fmtQty(q) {
  const n = Number(q);
  if (n === 0.5) return '½';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// פירוק דיבור בלי בינה מלאכותית: "חלב לחם ושתי עגבניות ונייר טואלט"
// → ["חלב","לחם","שתי עגבניות","נייר טואלט"]. מוצרים מרובי מילים מזוהים לפי המילון.
export function splitSpoken(text) {
  const multi = new Set(DICT_PHRASES());
  const starts = new Set(DICT_PHRASES().map((p) => p.split(' ')[0]));
  const toks = text.replace(/[,.،]/g, ' ').split(/\s+/).filter(Boolean);
  const isNum = (w) => numOf(w) != null;
  const strip = (w) => (w.length > 2 && w[0] === 'ו' && (isNum(w.slice(1)) || unitOf(w.slice(1)) != null || classify(w.slice(1)) || starts.has(w.slice(1))) ? w.slice(1) : w);
  const out = [];
  let i = 0;
  while (i < toks.length) {
    const parts = [];
    let w = strip(toks[i]);
    if (w === 'גם' || w === 'עוד' || w === 'של') { i++; continue; }
    while (i < toks.length && (isNum(w) || (unitOf(w) && unitOf(w) !== '') || w === 'של')) { parts.push(w); i++; w = strip(toks[i] || ''); }
    if (i >= toks.length) { if (parts.length) out.push(parts.join(' ')); break; }
    // מוצר של 3/2 מילים מהמילון
    let took = 1;
    for (const n of [3, 2]) {
      const phrase = [w, ...toks.slice(i + 1, i + n)].join(' ');
      if (i + n <= toks.length && multi.has(phrase)) { w = phrase; took = n; break; }
    }
    parts.push(w);
    i += took;
    out.push(parts.join(' '));
  }
  return out;
}

let _phrases = null;
function DICT_PHRASES() {
  if (!_phrases) _phrases = DICT.filter((d) => d.kw.includes(' ')).map((d) => d.kw);
  return _phrases;
}
