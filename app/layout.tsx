'import client';
import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        {/* תפריט עליון של האתר */}
        <header className="bg-white border-b sticky top-0 z-40 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="font-black text-lg tracking-tight">
              📱 חנות הסלולר
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/admin/products"
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                ⚙️ פאנל ניהול
              </Link>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
