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
המטרה שלך היא לקחת את שם המוצר והמידע הגולמי (או ההערות) שהמשתמש סיפק, ולעצב, לנסח ולשפר אותם בצורה מקצועית, שיווקית וברורה לחלוטין.

שם המוצר: "${productName}"
מידע גולמי / הערות לניסוח ועריכה: 
"""
${rawInfo || 'אין מידע גולמי נוסף, צור תיאורים ומפרט מקצועי על בסיס שם המוצר לבד'}
"""

עליך להחזיר אובייקט JSON חוקי הכולל בדיוק את השדות הבאים (ללא שום טקסט או מעטפת מעבר לכך):
{
  "shortDesc": "תיאור קצר ומושך בכמה מילים עם מודגשים ואימוג'י בפורמט Markdown",
  "description": "סקירה כללית מפורטת ושיווקית המותאמת לחנות NEW PHONE על בסיס המידע שקיבלת, בפורמט Markdown עם כותרות ##",
  "specs": "מפרט טכני מלא ומסודר בפורמט Markdown עם נקודות • המבוסס על הנתונים שניתנו",
  "seoTitle": "כותרת SEO שיווקית ומושכת בגוגל הכוללת את שם המוצר ושם החנות NEW PHONE",
  "seoDescription": "תיאור SEO שיווקי מושך בגוגל שמניע לפעולה לרכישת המוצר ב-NEW PHONE"
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
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
