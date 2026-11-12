// מנוע חיפוש קטן לחנות: מבין עברית ואנגלית ("אייפון" = "iphone"), שגיאות כתיב קטנות,
// אותיות סופיות, ניקוד וגרשיים. משמש גם את ההצעות בזמן הקלדה וגם את עמוד תוצאות החיפוש.

const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(text: unknown): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/["'`״׳‘’“”]/g, '')
    .replace(/[^a-z0-9א-ת]+/g, ' ')
    .trim();
}

// מילים נרדפות: כל מילה בקבוצה מוצאת גם את האחרות
const SYNONYMS: string[][] = [
  ['iphone', 'אייפון', 'איפון', 'אפל', 'apple'],
  ['samsung', 'סמסונג', 'סאמסונג'],
  ['galaxy', 'גלקסי', 'גלאקסי'],
  ['xiaomi', 'שיאומי', 'שאומי', 'redmi', 'רדמי'],
  ['nokia', 'נוקיה'],
  ['motorola', 'מוטורולה'],
  ['alcatel', 'אלקטל'],
  ['lg', 'אלגי'],
  ['sony', 'סוני'],
  ['qin', 'קין', 'צין'],
  ['mp3', 'mp4', 'נגן', 'נגנים'],
  ['כשר', 'כשרים', 'כשרה', 'kosher'],
  ['תומך', 'תומכי'],
  ['אוזניות', 'אוזניה', 'headphones', 'earbuds'],
  ['מטען', 'מטענים', 'charger', 'מטעו'],
  ['כבל', 'כבלים', 'cable'],
  ['כיסוי', 'כיסויים', 'case', 'קייס'],
  ['מגן', 'מגני', 'מגן מסך', 'protector', 'זכוכית'],
  ['סוללה', 'סוללות', 'battery', 'פאוורבנק', 'powerbank', 'מטען נייד'],
  ['טלפון', 'טלפונים', 'פלאפון', 'פלאפונים', 'סלולר', 'סלולרי', 'מכשיר', 'מכשירים', 'phone'],
  ['מקשים', 'מקשי', 'כפתורים', 'סבא', 'מבוגרים'],
  ['וואטסאפ', 'ווצאפ', 'whatsapp', 'ווטסאפ'],
  ['כרטיס', 'sd', 'זיכרון', 'זכרון'],
];

const SYN_MAP = new Map<string, string[]>();
for (const group of SYNONYMS) {
  const norm = group.map(normalize);
  for (const w of norm) SYN_MAP.set(w, norm);
}

// מספר השינויים (אות חסרה / מיותרת / שונה / שתי אותיות שהתחלפו) בין שתי מילים, עד גבול
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

const allowedTypos = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

// כמה מילת חיפוש אחת מתאימה למילה בטקסט: 1 = זהה, 0 = לא מתאימה
function wordScore(q: string, w: string, fuzzy: boolean): number {
  if (w === q) return 1;
  if (w.startsWith(q)) return q.length >= 2 ? 0.85 : 0;
  // תחילית "ה" / "ו" / "ל" / "ב" בעברית (המטען, ומטען)
  if (/^[הולבמש]/.test(w) && w.slice(1) === q) return 0.9;
  if (q.length >= 3 && w.includes(q)) return 0.6;
  const max = fuzzy ? allowedTypos(q.length) : 0;
  if (max) {
    const d = distance(q, w.slice(0, q.length + max), max);
    if (d <= max) return 0.55 - d * 0.1;
    const full = distance(q, w, max);
    if (full <= max) return 0.6 - full * 0.1;
  }
  return 0;
}

export type Searchable = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  kosher?: string | null;
  short_description?: string | null;
  description?: string | null;
  [k: string]: any;
};

type Prepared = { fields: { words: string[]; weight: number; text: string }[] };
const cache = new WeakMap<object, Prepared>();

function prepare(p: Searchable): Prepared {
  const hit = cache.get(p);
  if (hit) return hit;
  const make = (v: unknown, weight: number) => {
    const text = normalize(v);
    return { text, words: text ? text.split(' ') : [], weight };
  };
  const prepared = {
    fields: [
      make(p.name, 1),
      make(p.brand, 0.8),
      make(p.category, 0.7),
      make(p.kosher, 0.6),
      make(p.short_description, 0.35),
      make(p.description, 0.2),
    ],
  };
  cache.set(p, prepared);
  return prepared;
}

// ציון התאמה של מוצר לחיפוש (0 = לא מתאים), וכמה ממילות החיפוש נמצאו במוצר
export function matchProduct(p: Searchable, query: string): { score: number; matched: number; words: number } {
  const qWords = normalize(query).split(' ').filter(Boolean);
  if (!qWords.length) return { score: 0, matched: 0, words: 0 };
  let matched = 0;
  const { fields } = prepare(p);
  let total = 0;
  for (const q of qWords) {
    const variants = SYN_MAP.get(q) || [q];
    let best = 0;
    for (const v of variants) {
      const isOriginal = v === q;
      for (const f of fields) {
        if (!f.words.length) continue;
        // ביטוי של כמה מילים (למשל "מגן מסך") נבדק על כל הטקסט
        if (v.includes(' ')) {
          if (f.text.includes(v)) best = Math.max(best, f.weight);
          continue;
        }
        for (const w of f.words) {
          // שגיאות כתיב נסלחות רק בשם, מותג, קטגוריה וכשרות (לא בתיאור הארוך)
          const s = wordScore(v, w, f.weight >= 0.6) * f.weight * (isOriginal ? 1 : 0.92);
          if (s > best) best = s;
        }
      }
    }
    if (best > 0) matched++;
    total += best;
  }
  const nameText = fields[0].text;
  const phrase = normalize(query);
  // בונוס כשהשם מתחיל בדיוק במה שהוקלד
  if (nameText.startsWith(phrase)) total += 0.5;
  else if (nameText.includes(phrase)) total += 0.25;
  if (!matched) return { score: 0, matched: 0, words: qWords.length };
  return { score: total / qWords.length, matched, words: qWords.length };
}

export function scoreProduct(p: Searchable, query: string): number {
  const m = matchProduct(p, query);
  return m.matched === m.words ? m.score : 0;
}

export function searchProducts<T extends Searchable>(products: T[], query: string, limit?: number): T[] {
  if (!normalize(query)) return limit ? products.slice(0, limit) : products;
  const all = products.map((p) => ({ p, ...matchProduct(p, query) })).filter((x) => x.score > 0);
  // קודם מוצרים שכל המילים נמצאו בהם. אם אין כאלה, מראים את הכי קרובים (למשל "סמסונג גלקסי" כשאין גלקסי במלאי)
  const full = all.filter((x) => x.matched === x.words);
  const pool = full.length ? full : all.filter((x) => x.matched === Math.max(...all.map((y) => y.matched)));
  const top = Math.max(0, ...pool.map((x) => x.score));
  // התאמות חלשות מאוד (רק מילה בתיאור הארוך) לא מוצגות כשיש התאמות טובות
  const scored = pool
    .filter((x) => x.score >= top * 0.3)
    .map((x) => ({ p: x.p, s: x.score }))
    .sort((a, b) => b.s - a.s);
  return (limit ? scored.slice(0, limit) : scored).map((x) => x.p);
}
