# שעון נוכחות: מצב העבודה

מסמך המשך לשיחה הבאה עם Claude. כל מה שצריך לדעת כדי להמשיך מאותה נקודה.

## איפה הכול יושב

- **האתר:** https://shaon-nochechut.vercel.app
- **Vercel:** פרויקט `shaon-nochechut` בצוות `myphone3` (team id `team_lCaXrHkFHBL2FXEndgcmO2Ft`).
  מתפרסם מהריפו `myphone3/my-phone-`, ענף `claude/attendance-app`, תיקייה `attendance` (Root Directory).
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

## מה נשאר לעשות

1. להריץ את `setup.sql` בפרויקט `mkqjysfflavzfkckiuil` (טבלאות, RLS, פונקציות, cron).
2. להכניס ל-`attendance_config`:
   `push_url` = `https://shaon-nochechut.vercel.app/api/push`, `push_secret` = הסוד שב-Vercel.
3. ב-Supabase: Authentication → URL Configuration → Site URL = `https://shaon-nochechut.vercel.app`
   (אין לזה כלי MCP, המשתמש עושה בלוח הבקרה).
4. לבדוק: הרשמה, שמירה בענן, אישור בוס דרך `/?r=<token>`, התראה (`attendance_dispatch`).
5. להעביר את הקוד לריפו נפרד `shaon-nochechut` (המשתמש צריך לפתוח אותו; ל-GitHub App אין הרשאה ליצור ריפו).

## העדפות המשתמש

- מדבר עברית, ורוצה תשובות בעברית.
- לא לשאול על פעולות רגילות. לשאול רק לפני מחיקה או השהיה של משהו.
- לא לגעת ב-`bonus-tracker`: זו אפליקציה שהמשתמש משתמש בה.
