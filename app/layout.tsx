import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'NEW PHONE - הפלאפון החדש שלך',
  description: 'חנות הסלולר והמכשירים הכשרים המובילה',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        
        {/* הדר ראשי גלובלי עם לוגו מוגדל נקי ללא מלל נפרד, וקישורי ניהול ועגלה בלבד */}
        <header className="bg-white border-b sticky top-0 z-50 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <Link href="/" className="flex items-center group cursor-pointer">
              <img src="/Logo.JPG" alt="NEW PHONE" className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-2xl border p-0.5 shadow-xs bg-white" />
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/admin" className="bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer">
                ⚙️ ניהול
              </Link>
              <Link href="/cart" className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer">
                🛒 עגלה
              </Link>
            </div>
          </div>

          {/* שורת חיפוש גלובלית וצפה מתחת ללוגו */}
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 border-t border-gray-100">
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                🔍
              </div>
              <form action="/search" method="GET">
                <input
                  type="text"
                  name="q"
                  placeholder="חפש מכשיר, נגן, מותג או קטגוריה בכל האתר..."
                  className="w-full bg-gray-50 border-2 border-orange-500/20 focus:border-orange-600 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm font-medium shadow-xs outline-none transition"
                />
              </form>
            </div>
          </div>
        </header>

        {/* תוכן העמודים המשתנה */}
        <main className="min-h-screen">
          {children}
        </main>

        {/* פוטר תחתון */}
        <footer className="bg-gray-900 text-white py-8 px-4 text-center text-xs space-y-2 mt-16">
          <p className="font-bold text-orange-400">NEW PHONE - כל הזכויות שמורות © 2026</p>
          <p className="text-gray-400">החנות המובילה למכשירים כשרים, סלולר ונגנים באיכות הגבוהה ביותר.</p>
        </footer>

      </body>
    </html>
  );
}
