'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function WelcomeTooltip() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [hasUsedPromo, setHasUsedPromo] = useState(false);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isNotificationDismissed, setIsNotificationDismissed] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserAndPromo();

    // סגירת החלונית בלחיצה מחוץ לרכיב
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkUserAndPromo = async () => {
    // 1. בדיקת התחברות משתמש
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;
    setUser(currentUser);

    // בדיקה אם המשתמש הוא מנהל (לפי טבלת admins או מטדאטה)
    if (currentUser) {
      const { data: adminData } = await supabase
        .from('admins')
        .select('id')
        .eq('email', currentUser.email)
        .maybeSingle();
      if (adminData || currentUser.email === 'myphone3393@gmail.com') {
        setIsAdmin(true);
      }
    }

    // 2. שליפת הגדרות המבצע מהטבלה
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (!settingsData || !settingsData.announcement_text) return;

    try {
      const parsed = JSON.parse(settingsData.announcement_text);
      if (parsed && parsed.welcome_active) {
        setPromoConfig(parsed);

        // שליפת פרטי מוצר המתנה במידה ונבחר
        if (parsed.welcome_type === 'מתנה' && parsed.welcome_gift_product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('name, image_url, images')
            .eq('id', parsed.welcome_gift_product_id)
            .single();
          if (prod) setGiftProduct(prod);
        }
      }
    } catch (e) {
      // במידה והשדה אינו בפורמט JSON
    }

    // 3. בדיקה אם משתמש מחובר כבר ביצע הזמנה ומימש
    if (currentUser?.email) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('email', currentUser.email)
        .limit(1);
      
      if (orders && orders.length > 0) {
        setHasUsedPromo(true);
      }
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const getProductImage = (p: any) => {
    if (!p) return '';
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  const hasUnreadNotification = promoConfig?.welcome_active && !isNotificationDismissed && (!user || !hasUsedPromo);

  return (
    <div className="relative inline-block text-right" dir="rtl" ref={dropdownRef}>
      
      {/* 1. הכפתור הראשי בפינה */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-3.5 py-2 rounded-2xl shadow-xs transition duration-200 cursor-pointer font-bold text-xs"
      >
        {/* לוגו Google */}
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
        </div>

        <span>{user ? (user.user_metadata?.full_name || 'החשבון שלי') : 'התחברות'}</span>

        {/* אינדיקטור התראה חדשה */}
        {hasUnreadNotification && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
          </span>
        )}
      </button>

      {/* 2. חלונית התראות ופרופיל (Popover Dropdown) */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-50 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-4 animate-in fade-in zoom-in duration-150">
          
          {/* כותרת החלונית */}
          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="font-black text-sm text-gray-900 flex items-center gap-1.5">
              <span>🔔</span>
              <span>התראות ואישי</span>
            </span>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          {/* אם האורח אינו מחובר */}
          {!user && (
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>התחברות מהירה עם Google</span>
                <span>➔</span>
              </button>

              {/* כרטיסיית התראת הצטרפות */}
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
                      title="מחק התראה"
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

          {/* אם המשתמש מחובר */}
          {user && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-2xl border flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="overflow-hidden text-xs">
                  <span className="font-bold text-gray-900 block truncate">{user.user_metadata?.full_name || 'משתמש מחובר'}</span>
                  <span className="text-gray-400 block truncate">{user.email}</span>
                </div>
              </div>

              {/* כפתור כניסה לפאנל ניהול (מנהלים בלבד) */}
              {isAdmin && (
                <Link
                  href="/admin/coupons"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-black hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>פנאל ניהול אתר 🛠️</span>
                </Link>
              )}

              {/* התראה למשתמש מחובר שלא מימש */}
              {!hasUsedPromo && promoConfig?.welcome_active && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-1">
                  <span className="text-xs font-bold text-amber-900 block">⏳ מתנת ההצטרפות שלך בתוקף!</span>
                  <p className="text-[11px] text-amber-800">
                    המתנה שמורה לך בעגלה למשך {promoConfig.welcome_days_valid || 7} ימים.
                  </p>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="w-full bg-gray-100 hover:bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs transition cursor-pointer text-center"
              >
                התנתק מהחשבון
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
