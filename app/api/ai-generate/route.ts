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

    // מנגנון ניסיונות חוזרים אוטומטי למקרה של עומס זמני בשרתי גוגל
    let response: Response | null = null;
    let data: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        clearTimeout(timeoutId);
        data = await response.json();

        if (response.ok) {
          break;
        }

        // אם יש עומס (503 או 429), נמתין קצרות וננסה שוב אוטומטית
        if ((response.status === 503 || response.status === 429) && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        } else {
          break;
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (attempt === maxRetries - 1) throw fetchErr;
        await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }

    if (!response || !response.ok) {
      throw new Error(data?.error?.message || 'השרת חווה עומס זמני, אנא נסה שוב בעוד מספר שניות.');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('לא התקבלה תשובה תקינה מהמודל');
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
