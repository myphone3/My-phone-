import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();
    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const prompt = `
אתה מומחה שיווק דיגיטלי וקופירייטר מוביל עבור חנות הסלולר והמכשירים הכשרים "NEW PHONE".
הלקוח ביקש לייצר תוכן שיווקי ומפרט מלא עבור המוצר: "${productName}".

עליך לחפש מידע מדויק על המוצר ברשת ולייצר את השדות הבאים בפורמט JSON בדיוק כך (ללא מעטפת נוספת מעבר ל-JSON):
{
  "shortDesc": "תיאור קצר ומושך בכמה מילים עם מודגשים ואימוג'י בפורמט Markdown",
  "description": "סקירה כללית מפורטת ושיווקית המותאמת לחנות NEW PHONE, בפורמט Markdown עם כותרות ##",
  "specs": "מפרט טכני מלא ומדויק הכולל את כל הנתונים הטכניים האמיתיים של המכשיר ברשת בפורמט Markdown עם נקודות •",
  "seoTitle": "כותרת SEO שיווקית ומושכת בגוגל הכוללת את שם המוצר ושם החנות NEW PHONE",
  "seoDescription": "תיאור SEO שיווקי מושך בגוגל שמניע לפעולה לרכישת המוצר ב-NEW PHONE"
}

הקפד על דיוק מוחלט בנתונים הטכניים, שפה עברית עשירה וגבוהה, ומבנה מקצועי. מחזיר אך ורק אובייקט JSON תקין.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response from Gemini');
    }

    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
