import { NextResponse } from 'next/server';

// מאגר ערים ורחובות ישראלי מהיר ומקומי למניעת שגיאות רשת
const CITIES_DATA = [
  "ירושלים", "תל אביב - יפו", "חיפה", "ראשון לציון", "פתח תקווה", "אשדוד", "נתניה", 
  "בני ברק", "באר שבע", "חולון", "רמת גן", "אשקלון", "רחובות", "בת ים", "בית שמש", 
  "כפר סבא", "הרצליה", "חדרה", "מודיעין-מכבים-רעות", "נצרת", "לוד", "רמלה", "רעננה", 
  "מודיעין עילית", "רהט", "הוד השרון", "גבעתיים", "קריית אתא", "נהריה", "ביתר עילית", 
  "אום אל-פחם", "קריית גת", "ראש העין", "עפולה", "טבריה", "עכו", "שדרות", "אילת"
];

const STREETS_DATA = [
  "הרצל", "ז'בוטינסקי", "בן גוריון", "רבי עקיבא", "חזון איש", "הלחי", "רשב\"י",
  "דיזנגוף", "אבן גבירול", "אלנבי", "שדרות רוטשילד", "ויצמן", "שז\"ר", "הנשיא",
  "ירושלים", "העצמאות", "ארלוזורוב", "סוקולוב", "ביאליק", "ההגנה", "יצחק רבין",
  "שדרות ירושלים", "הירקון", "בגין", "מנחם בגין", "הפלמ\"ח", "דרך עכו", "האורגים"
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  if (type === 'city') {
    const filtered = CITIES_DATA.filter(c => c.includes(q));
    return NextResponse.json({ results: filtered });
  }

  if (type === 'street') {
    const filtered = STREETS_DATA.filter(s => s.includes(q));
    return NextResponse.json({ results: filtered });
  }

  return NextResponse.json({ results: [] });
}
