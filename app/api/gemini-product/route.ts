import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/mailer';

export const runtime = 'nodejs';

// עוזר ה-AI לתיאורי מוצרים. רץ בשרת כדי שהמפתח לא ייחשף בדפדפן, ורק למנהל מחובר.
export async function POST(request: Request) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const name = str(body?.name).trim();
    if (!name) {
      return NextResponse.json({ error: 'נא למלא שם מוצר לפני הפעלת ה-AI' }, { status: 400 });
    }
    const rawInfoText = `שם המוצר: ${name}\nתיאור קצר: ${str(body?.shortDesc)}\nתיאור מלא: ${str(body?.description)}\nמפרט: ${str(body?.specs)}`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'מפתח ה-AI לא מוגדר ב-Vercel (GEMINI_API_KEY)' }, { status: 500 });
    }

    const prompt = `אתה מומחה ניסוח, עריכה ועיצוב תוכן לחנות הסלולר והמכשירים הכשרים "NEW PHONE".
המשתמש סיפק נתונים טכניים ותיאור אמיתי על המוצר: "${name}".
המידע הגולמי שהוזן:
"""
${rawInfoText}
"""

הנחיות קריטיות לעבודה:
1. אל תמציא נתונים, תכונות או פיצ'רים שלא קיימים במידע הגולמי שהוזן. התבסס אך ורק על העובדות והנתונים האמיתיים שנמסרו.
2. התפקיד שלך הוא לקחת את הנתונים האמיתיים האלו ולערוך, לסדר ולעצב אותם בצורה מקצועית, נקייה ומשכנעת בפורמט Markdown עבור חנות "NEW PHONE".
3. החזר אך ורק אובייקט JSON תקין לחלוטין (ללא שום טקסט או מעטפת מסביב) במבנה הבא בדיוק:
{
  "shortDesc": "תיאור קצר ומדויק המבוסס על הנתונים עם אימוג'י ב-Markdown",
  "description": "סקירה מקצועית ומסודרת המבוססת אך ורק על הנתונים עם כותרות ## ב-Markdown",
  "specs": "מפרט טכני מסודר ומדויק לפי הנתונים עם נקודות • ב-Markdown",
  "seoTitle": "כותרת SEO מדויקת ומקצועית ל-NEW PHONE",
  "seoDescription": "תיאור SEO מדויק ל-NEW PHONE",
  "seoKeywords": "מילות מפתח רלוונטיות פסיק, פסיק"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'שגיאה בתקשורת מול ג׳מיני');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('לא התקבלה תשובה מהמודל');
    }

    let jsonStr = text.trim();
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    return NextResponse.json(JSON.parse(jsonStr));
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
