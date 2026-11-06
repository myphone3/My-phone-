// חיפוש שמבין גם שגיאות כתיב קטנות ("נוקיא" → "נוקיה", "אייפון"/"איפון")

const FINALS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalize(text: string) {
  return String(text || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // ניקוד
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[׳'"״`-]/g, '')
    .replace(/(.)\1+/g, '$1') // אותיות כפולות (איייפון)
    .replace(/[יו]/g, '') // אותיות קריאה: "איפון" = "אייפון", "נוקיה" = "נקיה"
    .replace(/[אהע](?=\s|$)/g, '') // סוף מילה: "נוקיא" = "נוקיה"
    .replace(/[^0-9a-z\u05D0-\u05EA\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// ציון התאמה של מילת חיפוש אחת לטקסט: 3 = מדויק, 2 = תחילת מילה/חלק, 1 = שגיאת כתיב, 0 = אין
function tokenScore(token: string, words: string[], full: string) {
  if (!token) return 3;
  if (words.includes(token)) return 3;
  if (full.includes(token)) return 2;
  const max = token.length >= 6 ? 2 : token.length >= 3 ? 1 : 0;
  if (!max) return 0;
  return words.some((w) => distance(token, w.slice(0, token.length + max), max) <= max) ? 1 : 0;
}

export function searchProducts<T extends Record<string, any>>(products: T[], query: string): T[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return products;
  const scored = products
    .map((p) => {
      const main = normalize([p.name, p.brand, p.sku].filter(Boolean).join(' '));
      const extra = normalize([p.category, p.kosher, p.tags, p.short_description, p.description].filter(Boolean).join(' '));
      const mainWords = main.split(' ');
      const allWords = `${main} ${extra}`.split(' ');
      let score = 0;
      for (const t of tokens) {
        const s = Math.max(tokenScore(t, mainWords, main) * 2, tokenScore(t, allWords, `${main} ${extra}`));
        if (!s) return null; // כל מילה בחיפוש חייבת להתאים
        score += s;
      }
      return { p, score };
    })
    .filter(Boolean) as { p: T; score: number }[];
  return scored.sort((a, b) => b.score - a.score).map((x) => x.p);
}
