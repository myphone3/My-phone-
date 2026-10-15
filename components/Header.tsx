'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [hasUsedPromo, setHasUsedPromo] = useState(false);
  const [isNotificationDismissed, setIsNotificationDismissed] = useState(false);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAdmin(currentUser.email);
          checkUserOrders(currentUser.email);
        }

        fetchPromoSettings();
      } catch (err) {
        console.error('Header init error:', err);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        checkAdmin(currentUser.email);
        checkUserOrders(currentUser.email);
      } else {
        setIsAdmin(false);
        setHasUsedPromo(false);
      }
    });

    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const totalItems = cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        setCartCount(totalItems);
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkAdmin = async (email?: string) => {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();

    if (cleanEmail === 'myphone3393@gmail.com' || cleanEmail === 'd0587223040@gmail.com') {
      setIsAdmin(true);
      return;
    }

    try {
      const { data } = await supabase
        .from('admins')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  const checkUserOrders = async (email?: string) => {
    if (!email) return;
    try {
      const { data } = await supabase.from('orders').select('id').eq('email', email).limit(1);
      if (data && data.length > 0) {
        setHasUsedPromo(true);
      }
    } catch {
      // ignore
    }
  };

  const fetchPromoSettings = async () => {
    try {
      const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (!settingsData || !settingsData.announcement_text) return;

      const parsed = JSON.parse(settingsData.announcement_text);
      if (parsed && parsed.welcome_active) {
        setPromoConfig(parsed);

        if (parsed.welcome_type === 'מתנה' && parsed.welcome_gift_product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('name, image_url, images')
            .eq('id', parsed.welcome_gift_product_id)
            .single();
          if (prod) setGiftProduct(prod);
        }
      }
    } catch {
      // fallback
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getProductImage = (p: any) => {
    if (!p) return '';
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  const hasUnreadNotification = promoConfig?.welcome_active && !isNotificationDismissed && (!user || !hasUsedPromo);
  const isUserAdmin = isAdmin || (user?.email && ['myphone3393@gmail.com', 'd0587223040@gmail.com'].includes(user.email.toLowerCase()));

  return (
    <header className="bg-white border-b sticky top-0 z-40 shadow-sm" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-4 space-y-3.5">
        
        {/* שורה עליונה */}
        <div className="flex items-center justify-between relative pt-1 pb-1">
          
          {/* צד שמאל: כפתור עגלה מוקטן ומרובע עם מספר בולט */}
          <Link 
            href="/cart" 
            className="relative p-2 bg-orange-50/40 hover:bg-orange-50 border-2 border-orange-200 text-orange-700 rounded-xl transition shadow-2xs flex items-center justify-center shrink-0 font-bold mr-2"
            title="עגלה"
          >
            <span className="text-lg">🛒</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-black border-2 border-white shadow-md">
                {cartCount}
              </span>
            )}
          </Link>

          {/* אמצע: לוגו */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer group shrink-0">
            <img src="/Logo.JPG" alt="NEW PHONE" className="w-20 h-20 object-contain shadow-xs group-hover:scale-105 transition" />
          </Link>

          {/* צד ימין: כפתור פרופיל עגול עם התראות ותפריט נפתח */}
          <div className="relative z-10 flex items-center" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative flex items-center justify-center w-12 h-12 bg-white hover:bg-orange-50/50 border-2 border-orange-200 rounded-full shadow-2xs transition duration-200 cursor-pointer overflow-hidden p-1 ml-2"
              title={user ? (user.user_metadata?.full_name || 'החשבון שלי') : 'התחברות והתראות'}
            >
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : user ? (
                <div className="w-full h-full bg-orange-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
              ) : (
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              )}

              {/* אינדיקטור התראה פועם */}
              {hasUnreadNotification && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-600 border-2 border-white"></span>
                </span>
              )}
            </button>

            {/* חלונית התראות ופרופיל נפתחת מתוקנת ובטוחה למסך */}
            {dropdownOpen && (
              <div className="absolute top-16 left-4 right-4 sm:left-auto sm:right-0 z-50 sm:w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-4 animate-in fade-in zoom-in duration-150">
                
                <div className="flex items-center justify-between border-b pb-2.5">
                  <span className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                    <span>🔔</span>
                    <span>התראות ואישי</span>
                  </span>
                  <button 
                    onClick={() => setDropdownOpen(false)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>

                {!user && (
                  <div className="space-y-3">
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="bg-white p-1 rounded-full flex items-center justify-center w-5 h-5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      </span>
                      <span>התחברות מהירה עם Google</span>
                    </button>

                    {promoConfig?.welcome_active && !isNotificationDismissed && (
                      <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-3 space-y-2.5 relative">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-orange-900 flex items-center gap-1">
                            <span>🎁</span>
                            <span>מתנת הצטרפות מחכה לך!</span>
                          </span>
                          <button 
                            onClick={() => setIsNotificationDismissed(true)}
                            className="text-[10px] text-gray-400 hover:text-red-500 font-bold"
                          >
                            מחק
                          </button>
                        </div>

                        {promoConfig.welcome_type === 'מתנה' && giftProduct ? (
                          <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-orange-100 shadow-2xs">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border shrink-0">
                              {getProductImage(giftProduct) ? (
                                <img src={getProductImage(giftProduct)} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <span>🎁</span>
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[10px] font-bold text-orange-600 block">מתנה בהזמנה ראשונה:</span>
                              <span className="text-xs font-extrabold text-gray-900 block truncate">{giftProduct.name}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-orange-800 font-medium">
                            הרשם עכשיו וקבל {promoConfig?.welcome_discount_value}% הנחה על ההזמנה הראשונה שלך!
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-orange-200/50">
                          <button
                            onClick={handleGoogleLogin}
                            className="text-xs font-bold text-orange-700 hover:underline cursor-pointer"
                          >
                            מימוש מתנה ➔
                          </button>
                          <button
                            onClick={() => setIsNotificationDismissed(true)}
                            className="text-[10px] text-gray-500 hover:text-gray-700 font-bold"
                          >
                            סמן כנקרא ✓
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {user && (
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded-2xl border flex items-center gap-3">
                      {user.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                          {user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="overflow-hidden text-xs">
                        <span className="font-bold text-gray-900 block truncate">{user.user_metadata?.full_name || 'משתמש מחובר'}</span>
                        <span className="text-gray-400 block truncate">{user.email}</span>
                      </div>
                    </div>

                    {isUserAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full bg-black hover:bg-gray-800 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <span>פנאל ניהול אתר 🛠️</span>
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full bg-gray-100 hover:bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs transition cursor-pointer text-center"
                    >
                      התנתק מהחשבון 🚪
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* שורה תחתונה: חיפוש */}
        <form onSubmit={handleSearchSubmit} className="relative w-full pt-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש מוצרים, מכשירים, נגנים או קטגוריות..."
            className="w-full bg-white border-2 border-orange-200 hover:border-orange-300 focus:border-orange-500 rounded-2xl py-2.5 pr-4 pl-10 text-xs font-medium text-gray-800 shadow-2xs outline-none transition"
          />
          <button type="submit" className="absolute left-3 top-[calc(50%+4px)] -translate-y-1/2 text-gray-400 hover:text-orange-600 transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>

      </div>
    </header>
  );
}
