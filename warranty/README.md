# קבלות ואחריות

אפליקציה (PWA) לשמירת קבלות לאחריות: מצלמים קבלה, השם של החנות, המוצר, התאריך והמחיר ממולאים לבד,
בוחרים כמה זמן אחריות (שנה, חצי שנה, שנתיים…) ורואים כמה זמן נשאר. יש חיפוש, סינון וייצוא לאקסל.

## איפה הכול יושב
- **Vercel:** פרויקט `kabalot` בצוות `myphone3`, Root Directory = `warranty`.
- **Supabase:** הפרויקט של החנות (`iiaxizrezhczgutqijbe`), טבלאות `wr_vaults`, `wr_receipts` ודלי תמונות `wr-photos`.
  הסכמה ב-`supabase/schema.sql` (כבר הורצה). הגישה רק דרך פונקציות `wr_*` שמקבלות את מזהה הארכיון (הקישור הסודי).
- **קריאת קבלות (AI):** `/api/read` שולח את התמונות לשרת של החנות (`STORE_AI_URL` = `/api/recipes-ai`) עם `WARRANTY_AI_SECRET`,
  והחנות משתמשת במפתח Gemini שלה. אפשר במקום זה לשים `GEMINI_API_KEY` ישירות בפרויקט.
  **הקריאה האוטומטית עובדת רק אחרי שהשינוי ב-`app/api/recipes-ai/route.ts` של החנות מגיע ל-`main`** (וגם `WARRANTY_AI_SECRET` מוגדר בפרויקט `my-phone`).
  עד אז ממלאים ידנית — כל השאר עובד.

## משתני סביבה
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STORE_AI_URL`, `WARRANTY_AI_SECRET` (זהה בשני הפרויקטים).

## רעיונות להמשך
- התראה לטלפון חודש לפני שהאחריות נגמרת.
- קבלות PDF מהמייל.
