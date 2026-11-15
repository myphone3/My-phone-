import { CATEGORIES } from './recipe';

export const PROMPT = `אתה עוזר שמסדר מתכונים. קיבלת צילומים/עמודים של מתכון (אולי בכתב יד, אולי מספר בישול) ו/או טקסט.
החזר JSON בלבד בצורה:
{"recipes":[{
 "title":"שם המתכון",
 "description":"משפט קצר אחד על המנה (אם יש במקור, אחרת ריק)",
 "category":"אחת מ: ${CATEGORIES.join(' | ')}",
 "servings": מספר מנות או null,
 "prep_minutes": זמן הכנה בדקות או null,
 "cook_minutes": זמן בישול/אפייה בדקות או null,
 "ingredients":[{"title":"שם החלק (למשל: לבצק, למילוי, לרוטב) או ריק אם יש חלק אחד","items":["2 כוסות קמח","1 כפית מלח"]}],
 "steps":[{"title":"שם החלק (למשל: הכנת הבצק, המילוי, הרכבה ואפייה) או ריק","items":["שלב ברור אחד","שלב נוסף"]}],
 "tips":["טיפ או הערה מהמקור"],
 "tags":["עד 4 תגיות קצרות, למשל: פרווה, ללא גלוטן, מהיר"],
 "photo": {"image": מספר התמונה (מתחיל ב-0) שבה יש צילום של המנה המוכנה, "box":[ymin,xmin,ymax,xmax] בסקאלה 0-1000} או null אם אין צילום של מנה
}]}
כללים:
- כתוב בעברית. אם המקור בשפה אחרת, תרגם לעברית טבעית.
- אל תמציא מצרכים, כמויות או שלבים שלא מופיעים במקור. אם משהו לא קריא, כתוב את מה שנראה הכי סביר וסמן "(?)".
- כל מצרך בשורה משלו, הכמות בהתחלה ("3 ביצים", "½ כוס שמן"). בלי מספור ובלי תבליטים.
- פרק את אופן ההכנה לשלבים קצרים וברורים לפי סדר העבודה, פעולה אחת או שתיים בכל שלב, בלי מספור. שמור על זמנים וטמפרטורות ("אופים 35 דקות ב-180 מעלות").
- חלק לחלקים רק כשבמתכון באמת יש כמה חלקים (בצק, מילוי, ציפוי וכו'). אחרת חלק אחד עם title ריק.
- אם בעמודים יש כמה מתכונים שונים, החזר כל אחד בנפרד במערך recipes.
- אם אין מתכון בכלל, החזר {"recipes":[]}.`;

export const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const num = (v) => (v === null || v === undefined || v === '' || !isFinite(+v) ? null : Math.round(+v * 10) / 10);
export const list = (v, n = 80) => (Array.isArray(v) ? v.map((x) => str(String(x ?? ''), 500)).filter(Boolean).slice(0, n) : []);
export const grp = (v) => (Array.isArray(v) ? v.map((g) => ({ title: str(g?.title, 80), items: list(g?.items) })).filter((g) => g.items.length).slice(0, 12) : []);

export function clean(r, imageCount) {
  const photo = r?.photo && Number.isInteger(+r.photo.image) && +r.photo.image >= 0 && +r.photo.image < imageCount && Array.isArray(r.photo.box) && r.photo.box.length === 4
    ? { image: +r.photo.image, box: r.photo.box.map((n) => Math.max(0, Math.min(1000, +n || 0))) } : null;
  return {
    title: str(r?.title, 120) || 'מתכון',
    description: str(r?.description, 300),
    category: CATEGORIES.includes(r?.category) ? r.category : 'אחר',
    servings: num(r?.servings),
    prep_minutes: num(r?.prep_minutes),
    cook_minutes: num(r?.cook_minutes),
    ingredients: grp(r?.ingredients),
    steps: grp(r?.steps),
    tips: list(r?.tips, 20),
    tags: list(r?.tags, 4).map((t) => t.slice(0, 24)),
    photo,
  };
}

