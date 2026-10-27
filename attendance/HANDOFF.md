# שעון נוכחות: מצב העבודה

מסמך המשך לשיחה הבאה עם Claude. כל מה שצריך לדעת כדי להמשיך מאותה נקודה.

## איפה הכול יושב

- **האתר:** https://shaon-nochechut.vercel.app
- **Vercel:** פרויקט `shaon-nochechut` בצוות `myphone3` (team id `team_lCaXrHkFHBL2FXEndgcmO2Ft`).
  מתפרסם מהריפו `myphone3/my-phone-`, תיקייה `attendance` (Root Directory). הענף הפעיל הוא `claude/attendance-app-handoff-pwddw6`,
  וכבר מוזגה אליו העבודה מ-`claude/attendance-app-handoff-hbfxwg`.
  **לפני כל פרסום:** לבדוק ב-`list_deployments` מאיזה ענף וקומיט עלתה הגרסה האחרונה, ולמזג אותה קודם. ככה לא דורסים גרסה חדשה בישנה.
  פרסום: `create_deployment` עם `gitSource` לענף ול-sha האחרון, `target: production`.
- **Supabase של השעון:** פרויקט `mkqjysfflavzfkckiuil` (`shaon-nochechut`, אזור ap-northeast-1),
  ארגון `shaon` (בעלים: `d0587223040+shaon@gmail.com`; `d0556771356@gmail.com` חבר בתפקיד Developer).
  ה-URL וה-publishable key כבר בתוך `index.html`.
- **Supabase של החנות** (`iiaxizrezhczgutqijbe`): לא קשור לשעון. נשארה שם טבלה ריקה `attendance_accounts`
  מהגרסה הראשונה. למחוק רק באישור המשתמש.

## משתני סביבה ב-Vercel

`VAPID_PUBLIC_KEY` (גם בתוך `index.html`), `VAPID_PRIVATE_KEY`, `PUSH_SECRET`.
`PUSH_SECRET` הוא sensitive ואי אפשר לקרוא אותו בחזרה. אם צריך אותו שוב: לייצר סוד חדש,
לעדכן ב-Vercel (upsert) ובטבלה `attendance_config` (מפתח `push_secret`) ואז לפרסם מחדש.

**26.10.2026 (שיחה שנייה):** הסוד הוחלף שוב ב-Vercel והאתר פורסם מחדש (`dpl_BCZLyFQBfgRxJt5kFkppxim2g7P2`).
`setup.sql` הורץ ב-`mkqjysfflavzfkckiuil` בחלקים דרך `execute_sql`, ו-`attendance_config` מכיל `push_url` ואת הסוד החדש.
Site URL הוגדר על ידי המשתמש. נבדק: cron `attendance-dispatch` רץ כל דקה בהצלחה, `/api/push` מחזיר 200 לסוד הנכון ו-401 לשגוי.

**שים לב:** שאלות האישור של Supabase MCP (elicitation) לא מגיעות למשתמש בממשק שלו, והן נכשלות אחרי 60 שניות.
כל SQL שמכיל `delete` או `drop` נתקע. שאר הפקודות עוברות דרך `execute_sql` בלי אישור.
לכן `attendance_dispatch` הותקנה **בלי** השורה `delete from attendance_outbox where created_at < now() - interval '3 days'`.
זה לא דחוף (מדובר בשורה אחת לכל התראה). אפשר להוסיף אותה אחר כך: המשתמש מדביק את `setup.sql` המלא ב-SQL Editor.

ממצאי Advisor שנשארו בכוונה: `attendance_get_report`/`respond_report` פתוחות ל-anon (קישור הבוס מוגן ב-token אקראי);
ל-`config` ול-`outbox` אין policies (רק השרת ניגש אליהן); `pg_net` ב-public.

## מבנה האפליקציה (מ-26.10.2026)

שלוש לשוניות:
- **נוכחות:** למעלה בוחרים סוג ספירה (`settings.entryMode`): `clock` (שעון חופשי), `timer` (לאחור), `goal` (יעד שעות יומי).
  במצב יעד `active.planMin` = היעד פחות מה שכבר עבדו היום, כך שההתראות מהשרת עובדות בלי שינוי ב-SQL.
  כפתור הפסקה עוצר את השעון. הפסקה קבועה (`autoBreakOn/autoBreakMin`) נוספת אוטומטית בכניסה.
- **החודש:** סיכום, ״יעד ותחזית״ (`planInfo`: שעות ביום ליעד, תחזית לפי קצב, הכנסה לפי אחוז משרה, 100% = 42 ש׳), השוואה של 6 חודשים, גרף, חישוב שכר, פירוט לפי ימים.
- **הגדרות:** פרופיל וסיסמה, שכר, הפסקות, נסיעות, יעד/ימי עבודה/אחוז משרה, התראות, שיתוף (חלון `shareModal`: אישור בוס, וואטסאפ, מייל, Excel, PDF), היסטוריה, שעות נוספות, נטו, נתונים.

**יועץ משכורת:** "תוכנית מהירה" (`quickPlanModal`, שאלות קבועות וחישוב `advise`), וצ'אט AI (`advisorModal`) שעובד דרך `/api/advisor`. הפונקציה בודקת טוקן של Supabase ושולחת ל-Gemini את ההקשר מ-`aiContext()`. הצ'אט דורש `GEMINI_API_KEY` ב-Vercel, ובלעדיו הוא אומר שהיועץ עוד לא מחובר.

- **הגדרות, אחרי 27.10:** ימי העבודה ואחוז המשרה נמצאים בכרטיס ״שכר והיקף משרה״, ולא בכרטיס היעד. בכרטיס ״שיתוף האפליקציה״ (בקבוצה ״כללי״) יש שיתוף, העתקת קישור והורדת APK.

## אפליקציית אנדרואיד (APK)

- `attendance-android/`: עטיפת TWA (androidbrowserhelper) שפותחת את האתר במסך מלא דרך כרום. חבילה `com.myphone.shaon`.
- נבנית ב-GitHub Actions (`.github/workflows/attendance-apk.yml`) בכל דחיפה לתיקייה, ומתפרסמת בריליס `shaon-apk-latest`:
  https://github.com/myphone3/My-phone-/releases/download/shaon-apk-latest/shaon-nochechut.apk
- מפתח החתימה שמור בריפו הציבורי, כמו ב-`tv-remote`, באישור המשתמש. טביעת האצבע שלו רשומה ב-`attendance/.well-known/assetlinks.json`.

## מה נשאר לעשות

1. בדיקה בטלפון: הרשמה, שמירה בענן, אישור בוס דרך `/?r=<token>`, התראה ברקע.
2. להעביר את הקוד לריפו נפרד `shaon-nochechut` (המשתמש צריך לפתוח אותו; ל-GitHub App אין הרשאה ליצור ריפו).

## העדפות המשתמש

- מדבר עברית, ורוצה תשובות בעברית.
- לא לשאול על פעולות רגילות. לשאול רק לפני מחיקה או השהיה של משהו.
- לא לגעת ב-`bonus-tracker`: זו אפליקציה שהמשתמש משתמש בה.
