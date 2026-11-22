import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// עיר ואזור של המבקר לפי כתובת ה-IP (Vercel מוסיף את זה לכל בקשה). ברמת עיר בלבד, בלי לשמור את ה-IP.
// משמש את הסטטיסטיקה ("מאיפה הגולשים"). מחוץ ל-Vercel מחזיר ריק.
const decode = (v: string | null) => {
  if (!v) return '';
  try {
    return decodeURIComponent(v).slice(0, 60);
  } catch {
    return v.slice(0, 60);
  }
};

// שמות ערים נפוצות בעברית
const HE: Record<string, string> = {
  Jerusalem: 'ירושלים', 'Tel Aviv': 'תל אביב', 'Tel Aviv-Yafo': 'תל אביב', 'Bnei Brak': 'בני ברק', "Bene Beraq": 'בני ברק',
  Haifa: 'חיפה', Ashdod: 'אשדוד', 'Petah Tikva': 'פתח תקווה', 'Petah Tiqva': 'פתח תקווה', 'Rishon LeZion': 'ראשון לציון',
  "Rishon LeTsiyyon": 'ראשון לציון', Netanya: 'נתניה', 'Beersheba': 'באר שבע', "Be'er Sheva": 'באר שבע', Holon: 'חולון',
  'Ramat Gan': 'רמת גן', Rehovot: 'רחובות', Ashkelon: 'אשקלון', 'Bat Yam': 'בת ים', 'Beit Shemesh': 'בית שמש',
  'Bet Shemesh': 'בית שמש', 'Kfar Saba': 'כפר סבא', Herzliya: 'הרצליה', Hadera: 'חדרה', "Modi'in-Maccabim-Re'ut": 'מודיעין',
  "Modi'in Illit": 'מודיעין עילית', 'Beitar Illit': 'ביתר עילית', "Betar 'Illit": 'ביתר עילית', Elad: 'אלעד', "El'ad": 'אלעד',
  Lod: 'לוד', Ramla: 'רמלה', Raanana: 'רעננה', "Ra'anana": 'רעננה', Nazareth: 'נצרת', Tiberias: 'טבריה', Safed: 'צפת',
  Zefat: 'צפת', 'Givatayim': 'גבעתיים', 'Kiryat Gat': 'קריית גת', 'Kiryat Ata': 'קריית אתא', 'Or Yehuda': 'אור יהודה',
  Afula: 'עפולה', Eilat: 'אילת', Netivot: 'נתיבות', Ofakim: 'אופקים', Dimona: 'דימונה', Arad: 'ערד', Yavne: 'יבנה',
  'Kiryat Malakhi': 'קריית מלאכי', 'Rosh HaAyin': 'ראש העין', 'Hod HaSharon': 'הוד השרון', Karmiel: 'כרמיאל', Nahariya: 'נהריה',
  Acre: 'עכו', Akko: 'עכו', Sderot: 'שדרות', 'Immanuel': 'עמנואל', 'Kiryat Ye\'arim': 'קריית יערים',
};

export function GET(request: Request) {
  const h = request.headers;
  const city = decode(h.get('x-vercel-ip-city'));
  const country = (h.get('x-vercel-ip-country') || '').slice(0, 2).toUpperCase();
  const region = decode(h.get('x-vercel-ip-country-region'));
  return NextResponse.json(
    { city: HE[city] || city, region, country },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
