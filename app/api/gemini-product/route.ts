import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { productName, rawInfo } = await request.json();
    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key not configured' }, { status: 500 });
    }

    const prompt = `אתה מומחה ניסוח, עריכה ועיצוב תוכן לחנות הסלולר והמכשירים הכשרים "NEW PHONE".
המשתמש סיפק נתונים טכניים ותיאור אמיתי על המוצר: "${productName}".
המידע הגולמי שהוזן:
"""
${rawInfo || 'אין מידע נוסף, התבסס על שם המוצר'}
"""

הנחיות קריטיות לעבודה:
1. אל תמציא נתונים, תכונות או פיצ'רים שלא קיימים במידע הגולמי שהוזן. התבסס אך ורק על העובדות והנתונים האמיתיים שנמסרו.
2. התפקיד שלך הוא לקחת את הנתונים האמיתיים האלו ולערוך, לסדר ולעצב אותם בצורה מקצועית, נקייה ומשכנעת בפורמט Markdown.
3. החזר אך ורק אובייקט JSON תקין לחלוטין (ללא טקסט מסביב) במבנה הבא בדיוק:
{
  "shortDesc": "תיאור קצר ומדויק עם אימוג'י ב-Markdown",
  "description": "סקירה מקצועית ומסודרת עם כותרות ## ב-Markdown",
  "specs": "מפרט טכני מסודר עם נקודות • ב-Markdown",
  "seoTitle": "כותרת SEO מדויקת ל-NEW PHONE",
  "seoDescription": "תיאור SEO מדויק ל-NEW PHONE"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'שגיאה בתקשורת מול שרתי ה-AI');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('לא התקבלה תשובה מהמודל');
    }

    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsedData = JSON.parse(jsonStr);
    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
