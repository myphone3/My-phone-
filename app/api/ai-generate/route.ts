import { NextResponse } from 'next/server';

async function callGeminiWithRetry(apiKey: string, prompt: string, retries = 3): Promise<any> {
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  
  for (const model of models) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          return data;
        }

        // אם יש עומס זמני (503) או הגבלת קצב (429), נמתין וננסה שוב אוטומטית
        if (response.status === 503 || response.status === 429) {
          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
            continue;
          }
        } else {
          // עבור שגיאה מסוג אחר, נעבור מיד למודל הגיבוי
          break;
        }
      } catch (err) {
        if (attempt === retries - 1) break;
        await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }
  throw new Error('השרתים חווים כרגע עומס זמני. אנא נסה שוב בעוד מספר שניות.');
}

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();
    if (!productName) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key not configured' }, { status: 500 });
    }

    const prompt = `אתה מומחה שיווק דיגיטלי וקופירייטר מוביל עבור חנות הסלולר והמכשירים הכשרים "NEW PHONE".
הלקוח ביקש לייצר תוכן שיווקי ומפרט מלא עבור המוצר: "${productName}".

עליך לספק את השדות הבאים בפורמט JSON בלבד (ללא שום טקסט נוסף סביב, רק אובייקט JSON תקין לחלוטין):
{
  "shortDesc": "תיאור קצר ומושך בכמה מילים עם מודגשים ואימוג'י בפורמט Markdown",
  "description": "סקירה כללית מפורטת ושיווקית המותאמת לחנות NEW PHONE, בפורמט Markdown עם כותרות ##",
  "specs": "מפרט טכני מלא ומדויק הכולל נתונים טכניים של המכשיר בפורמט Markdown עם נקודות •",
  "seoTitle": "כותרת SEO שיווקית ומושכת בגוגל הכוללת את שם המוצר ושם החנות NEW PHONE",
  "seoDescription": "תיאור SEO שיווקי מושך בגוגל שמניע לפעולה לרכישת המוצר ב-NEW PHONE"
}
שמור על דיוק, שפה עברית עשירה ומקצועית, ומבנה JSON תקין בלבד.`;

    const data = await callGeminiWithRetry(apiKey, prompt);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response text from Gemini');
    }

    let jsonStr = text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(jsonStr);
    return NextResponse.json(parsedData);
  } catch (err: any) {
    console.error('AI generation error:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
