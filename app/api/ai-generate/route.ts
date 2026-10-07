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

    const prompt = `אתה מומחה שיווק דיגיטלי וקופירייטר מוביל עבור חנות הסלולר והמכשירים הכשרים "NEW PHONE".
המטרה שלך היא לערוך ולשפר את הטקסטים והמפרט הבאים עבור המוצר בצורה שיווקית וברורה בפורמט Markdown.

שם המוצר: "${productName}"
מידע לעריכה:
"""
${rawInfo || 'אין מידע נוסף, צור על בסיס שם המוצר'}
"""

החזר אך ורק אובייקט JSON תקין לחלוטין (ללא שום טקסט מסביב) במבנה הבא בדיוק:
{
  "shortDesc": "תיאור קצר ומושך עם אימוג'י ב-Markdown",
  "description": "סקירה שיווקית מפורטת עם כותרות ## ב-Markdown",
  "specs": "מפרט טכני מסודר עם נקודות • ב-Markdown",
  "seoTitle": "כותרת SEO שיווקית ל-NEW PHONE",
  "seoDescription": "תיאור SEO שיווקי ל-NEW PHONE"
}`;

    // כתובת קשיחה לחלוטין ללא שום משתנים שעלולים להשתבש
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
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
