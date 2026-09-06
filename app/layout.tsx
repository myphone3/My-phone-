'use client';

import './globals.css';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkUserAndCart();
  }, []);

  const checkUserAndCart = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (profile?.is_admin || currentUser.email?.includes('admin')) {
        setIsAdmin(true);
      }
    }

    try {
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const totalItems = localCart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      setCartCount(totalItems);
    } catch (e) {
      setCartCount(0);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        
        {/* הדר ראשי גלובלי */}
        <header className="bg-white border-b sticky top-0 z-50 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
            
            {/* צד ימין: התחברות עם גוגל או כפתור ניהול */}
            <div className="flex items-center justify-start gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Link href="/admin" className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer">
                      ⚙️ ניהול
                    </Link>
                  )}
                  <button 
                    onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    התנתק 🚪
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>🌐</span> התחברות עם גוגל
                </button>
              )}
            </div>

            {/* מרכז: לוגו גדול בלי מסגרת */}
            <div className="flex justify-center">
              <Link href="/" className="flex items-center group cursor-pointer">
                <img src="/Logo.JPG" alt="NEW PHONE" className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-transparent group-hover:scale-105 transition" />
              </Link>
            </div>

            {/* צד שמאל: עגלת קניות */}
            <div className="flex items-center justify-end">
              <Link href="/cart" className="relative bg-gray-900 hover:bg-black text-white p-2.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer">
                <span className="text-base">🛒</span>
                <span className="hidden sm:inline">עגלה</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>

          </div>

          {/* שורת חיפוש גלובלית וצפה מתחת להדר */}
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 border-t border-gray-100">
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                🔍
              </div>
              <form action="/search" method="GET">
                <input
                  type="text"
                  name="q"
                  placeholder="חיפוש מוצרים, מכשירים, נגנים או קטגוריות..."
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
