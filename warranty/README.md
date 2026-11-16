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
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STORE_AI_URL`, `WARRANTY_AI_SECRET` (זהה בשני הפרויקטים),
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (התראות), `CRON_SECRET` (זהה לערך `cron_secret` בטבלה `wr_config`).

## שדרוג 2 (נובמבר 2026)
- `supabase/schema-2.sql`: טלפונים, מספר קבלה, הרחבת אחריות, PDF בדלי, טבלאות התראות (`wr_push`, `wr_sent`, `wr_config`).
- **נעילה בקוד ברמת הארכיון** (`lib/lock.js`, `components/Lock.js`): הקוד נבדק בשרת (`wr_unlock`, bcrypt, 5 טעויות = 15 דקות המתנה).
  בלי קוד, `wr_get_vault` מחזיר רק `locked` ושאר הפונקציות נכשלות — בכל מכשיר. קוד נכון = "כרטיס כניסה" (`wr_tokens`, 180 יום, מתבטל כשמחליפים קוד).
  בכל פתיחה מבקשים קוד או טביעת אצבע / Face ID (WebAuthn, רשום לכל טלפון בנפרד). יש קוד שחזור (8 תווים) שמוצג פעם אחת.
  אין פקודות delete ב-SQL (שאלת האישור של Supabase MCP לא מגיעה למשתמש): מחיקת קבלה = `deleted_at`, ביטול התראה = `disabled_at`.
- הגדרות בטלפון בלבד (`lib/settings.js`): התראות, סיכום הוצאות, שיפור תמונות (`lib/image.js`).
- התראות: `/api/cron/remind` רץ כל יום ב-07:00 UTC (`vercel.json`) ושולח חודש ושבוע לפני סוף האחריות.
- "המוצר התקלקל": בתוך כל קבלה (`app/v/[id]/detail.js`).
- שיתוף מהגלריה/מייל: `share_target` במניפסט + `public/sw.js` ← `/?shared=1`.
- פיצול קבלה לכמה מוצרים: בעורך, כשה-AI מזהה כמה מוצרים.
- APK: `warranty-android/` נבנה ב-GitHub Actions (`warranty-apk.yml`) ומתפרסם ב-
  https://github.com/myphone3/My-phone-/releases/download/kabalot-apk-latest/kabalot.apk
  (אותו מפתח חתימה כמו בשעון הנוכחות; טביעת האצבע ב-`public/.well-known/assetlinks.json`).
- מיילים: אין כתובת מייל ייעודית — מעבירים חשבונית מהמייל ב"שיתוף" או בוחרים PDF.

