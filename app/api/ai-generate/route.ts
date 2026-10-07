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
התפקיד שלך הוא לקחת את המידע הגולמי שסופק ולערוך אותו בצורה יפה, ברורה, מקצועית ושיווקית עבור המוצר.

שם המוצר: "${productName}"
מידע גולמי / הערות לעריכה: "${rawInfo || 'אין מידע גולמי נוסף, צור על בסיס שם המוצר והכרות עם סוג מכשיר זה'}"

עליך להחזיר אובייקט JSON חוקי הכולל בדיוק את השדות הבאים:
{
  "shortDesc": "תיאור קצר ומושך בכמה מילים עם מודגשים ואימוג'י בפורמט Markdown",
  "description": "סקירה כללית מפורטת ושיווקית המותאמת לחנות NEW PHONE על בסיס המידע שקיבלת, בפורמט Markdown עם כותרות ##",
  "specs": "מפרט טכני מלא ומסודר בפורמט Markdown עם נקודות • המבוסס על הנתונים שניתנו",
  "seoTitle": "כותרת SEO שיווקית ומושכת בגוגל הכוללת את שם המוצר ושם החנות NEW PHONE",
  "seoDescription": "תיאור SEO שיווקי מושך בגוגל שמניע לפעולה לרכישת המוצר ב-NEW PHONE"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response text from Gemini');
    }

    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
