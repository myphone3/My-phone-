# ביבי-מוניטור (אנדרואיד)

מכשיר אחד בחדר התינוק מאזין, ומכשירי ההורים (אפשר כמה) מקבלים שמע חי והתראת בכי, גם כשהמסך כבוי.

## בנייה
הבנייה רצה אוטומטית ב-GitHub Actions (`.github/workflows/baby-monitor-apk.yml`) בכל שינוי בתיקייה הזו.
קובץ ה-APK מתפרסם בעמוד Releases של הריפו.

כתובת ומפתח Supabase הציבוריים של החנות מוגדרים בקוד (`src/main.js`). אפשר לדרוס אותם בסודות `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
סודות לא חובה (Settings > Secrets and variables > Actions): `TURN_URLS` (מופרד בפסיקים), `TURN_USERNAME`, `TURN_CREDENTIAL` - שרת ממסר לשמע חי ברשתות סלולריות.

## פיתוח מקומי
```
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```
