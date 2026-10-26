# שעון נוכחות

אפליקציית ווב (PWA) לרישום שעות עבודה, חישוב שכר ודוח לבוס.
קבצים סטטיים + פונקציה אחת (`api/push.js`) ששולחת התראות. מתפרסם ב-Vercel כפרויקט נפרד עם Root Directory = `attendance`.

- הקמת מסד הנתונים: מריצים את `setup.sql` ב-SQL Editor של Supabase.
- משתני סביבה ב-Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET`.

- התחברות וגיבוי: Supabase Auth (מייל + סיסמה), הנתונים בטבלה `attendance_accounts` עם RLS — כל משתמש רואה רק את השורה שלו.
- `sw.js` שומר את קבצי האפליקציה לעבודה גם בלי רשת.
