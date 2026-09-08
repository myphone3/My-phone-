'use client';

import './globals.css';
import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cartCount, setCartCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Live Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserAndCart();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live search results when query changes
  useEffect(() => {
    const fetchLiveSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const q = searchQuery.toLowerCase();
      const { data } = await supabase
        .from('products')
        .select('*')
        .or('is_published.is.null,is_published.eq.true');

      if (data) {
        const filtered = data.filter((p) => 
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
        ).slice(0, 5); // הצגת עד 5 תוצאות מהירות בחלון הנפתח
        setSearchResults(filtered);
      }
    };

    const timer = setTimeout(() => {
      fetchLiveSearch();
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const checkUserAndCart = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser) {
      const avatar = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '';
      setUserAvatar(avatar);
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
        
        {/* הדר ראשי צף הכולל לוגו, עגלה, פרופיל ושורת חיפוש חיה */}
        <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
            
            {/* צד ימין: פרופיל */}
            <div className="flex items-center justify-start relative" ref={dropdownRef}>
              {user ? (
                <div>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 p-1 rounded-full border-2 border-orange-500/40 hover:border-orange-600 transition cursor-pointer shadow-xs bg-white"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="Profile" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-sm">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>

                  {showDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-2xl py-3 z-50 space-y-2">
                      <div className="px-4 py-1.5 border-b text-[11px] text-gray-500 truncate">
                        מחובר בתור:<br />
                        <span className="font-bold text-gray-900">{user.email}</span>
                      </div>

                      <div className="px-4 py-2 bg-orange-50/50 rounded-xl mx-2 border border-orange-100 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-orange-800">
                          <span>🔔</span> התראות ועדכונים
                        </div>
                        <p className="text-[11px] text-gray-600 leading-snug">
                          ברוך הבא לחנות NEW PHONE! אין התראות חדשות כרגע.
                        </p>
                      </div>

                      <Link 
                        href="/admin" 
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl mx-2 transition text-center justify-center shadow-xs"
                      >
                        ⚙️ מעבר לאתר ניהול
                      </Link>

                      <button
                        onClick={async () => {
                          await supabase.auth.signOut();
                          window.location.reload();
                        }}
                        className="w-full text-right flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition border-t pt-2 mt-1"
                      >
                        🚪 התנתק מהמערכת
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="bg-white border border-orange-500/40 hover:bg-orange-50 text-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>🌐</span> התחברות עם גוגל
                </button>
              )}
            </div>

            {/* מרכז: לוגו גדול */}
            <div className="flex justify-center">
              <Link href="/" className="flex items-center group cursor-pointer">
                <img src="/Logo.JPG" alt="NEW PHONE" className="w-20 h-20 sm:w-28 sm:h-28 object-contain bg-transparent group-hover:scale-105 transition" />
              </Link>
            </div>

            {/* צד שמאל: עגלה */}
            <div className="flex items-center justify-end">
              <Link href="/cart" className="relative bg-orange-500/10 hover:bg-orange-500/20 border-2 border-orange-500/40 text-orange-900 p-2.5 sm:px-4 sm:py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer">
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

          {/* שורת חיפוש צפה עם תוצאות חיפוש חיות (Autocomplete) */}
          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 border-t border-gray-100 relative" ref={searchRef}>
            <div className="max-w-2xl mx-auto relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                🔍
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="חיפוש מוצרים, מכשירים, נגנים או קטגוריות..."
                className="w-full bg-gray-50 border-2 border-orange-500/30 focus:border-orange-600 rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm font-medium shadow-xs outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              )}

              {/* תפריט תוצאות חיפוש נפתח בזמן הקלדה */}
              {isSearchFocused && searchQuery.trim().length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-y-auto z-50 p-2 space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center font-medium">לא נמצאו מוצרים תואמים</div>
                  ) : (
                    searchResults.map((prod) => {
                      const img = prod.image_url || prod.images?.[0] || '';
                      return (
                        <Link
                          key={prod.id}
                          href={`/product/${prod.id}`}
                          onClick={() => setIsSearchFocused(false)}
                          className="flex items-center gap-3 p-2.5 hover:bg-orange-50/60 rounded-xl transition group cursor-pointer"
                        >
                          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border">
                            {img ? (
                              <img src={img} alt={prod.name} className="w-full h-full object-contain" />
                            ) : (
                              <span>📦</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-gray-900 truncate group-hover:text-orange-600 transition">{prod.name}</h4>
                            <p className="text-[10px] text-gray-400 truncate">{prod.brand || prod.category || 'מוצר בחנות'}</p>
                          </div>
                          <span className="text-xs font-black text-orange-600 shrink-0">
                            ₪{prod.sale_price || prod.price}
                          </span>
                        </Link>
                      );
                    })
                  )}
                  <div className="border-t pt-2 mt-1 text-center">
                    <Link
                      href={`/search?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setIsSearchFocused(false)}
                      className="text-xs font-bold text-orange-600 hover:underline block py-1"
                    >
                      הצג את כל התוצאות עבור &quot;{searchQuery}&quot; ➔
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-screen">
          {children}
        </main>

        <footer className="bg-gray-900 text-white py-8 px-4 text-center text-xs space-y-2 mt-16">
          <p className="font-bold text-orange-400">NEW PHONE - כל הזכויות שמורות © 2026</p>
          <p className="text-gray-400">החנות המובילה למכשירים כשרים, סלולר ונגנים באיכות הגבוהה ביותר.</p>
        </footer>

      </body>
    </html>
  );
}
