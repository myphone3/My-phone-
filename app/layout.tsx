'use client';

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

            <div className="flex items-center gap-2 sm:gap-3">
              {/* אזור התראות / עגלה */}
              <Link
                href="/"
                className="relative bg-gray-100 hover:bg-gray-200 p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center"
                title="התראות ועגלה"
              >
                🔔
              </Link>

              {/* כפתור התחברות / גוגל */}
              <button
                type="button"
                onClick={() => alert('התחברות באמצעות Google תתבצע מול מערכת האימות.')}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.3 7.23 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.87 0 11.76s.43 3.63 1.18 5.15l4.09-2.67z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.7 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
                </svg>
                <span className="hidden sm:inline">התחברות</span>
              </button>

              <Link
                href="/admin/products"
                className="bg-black text-white hover:bg-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1"
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
