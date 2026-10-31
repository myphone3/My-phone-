# ביבי-מוניטור (אנדרואיד)

מכשיר אחד בחדר התינוק מאזין, ומכשירי ההורים (אפשר כמה) מקבלים שמע חי והתראת בכי, גם כשהמסך כבוי.

## בנייה
הבנייה רצה אוטומטית ב-GitHub Actions (`.github/workflows/baby-monitor-apk.yml`) בכל שינוי בתיקייה הזו.
קובץ ה-APK מתפרסם בעמוד Releases של הריפו.

סודות נדרשים (Settings > Secrets and variables > Actions):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - אותם ערכים של החנות.
- לא חובה: `TURN_URLS` (מופרד בפסיקים), `TURN_USERNAME`, `TURN_CREDENTIAL` - שרת ממסר לשמע חי ברשתות סלולריות.

## פיתוח מקומי
```
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run dev
```
