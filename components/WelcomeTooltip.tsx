'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function WelcomeTooltip() {
  const [user, setUser] = useState<any>(null);
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [hasUsedPromo, setHasUsedPromo] = useState(false);

  useEffect(() => {
    checkUserAndPromo();
  }, []);

  const checkUserAndPromo = async () => {
    // 1. בדיקת התחברות משתמש
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user || null;
    setUser(currentUser);

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

  const getProductImage = (p: any) => {
    if (!p) return '';
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  if (!promoConfig || !promoConfig.welcome_active) return null;

  // תרחיש 1: אורח לא מחובר -> ההתראה הופכת בעצמה לכפתור התחברות Google אינטראקטיבי
  if (!user) {
    const giftImg = getProductImage(giftProduct);

    return (
      <div className="absolute top-3 right-4 sm:right-8 z-50 animate-subtle-pulse">
        <button
          onClick={handleGoogleLogin}
          className="relative bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white p-3.5 px-4 rounded-2xl shadow-xl border-2 border-white/80 text-right cursor-pointer transition flex items-center gap-3 group"
          dir="rtl"
        >
          {/* אייקון Google קטן עם רקע לבן */}
          <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-orange-100 group-hover:scale-110 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm text-white">מגיע לך מתנת הצטרפות! 🎁</span>
              <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-md font-bold">לחץ להתחברות</span>
            </div>

            {promoConfig.welcome_type === 'מתנה' && giftProduct ? (
              <div className="flex items-center gap-2 bg-black/20 p-1.5 px-2.5 rounded-xl border border-white/20">
                {giftImg && (
                  <img src={giftImg} alt="" className="w-6 h-6 object-contain bg-white rounded-md p-0.5" />
                )}
                <span className="text-[11px] font-bold text-orange-100 truncate max-w-[180px]">
                  לחץ להתחברות עם גוגל וקבל {giftProduct.name} במתנה!
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-orange-100 font-medium">
                לחץ כאן להתחברות מהירה עם גוגל וקבל {promoConfig.welcome_discount_value}% הנחה!
              </p>
            )}
          </div>
        </button>
      </div>
    );
  }

  // תרחיש 2: משתמש מחובר שלא מימש עדיין את ההטבה והיא בתוקף
  if (user && !hasUsedPromo) {
    return (
      <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-gray-900 text-white p-3.5 px-5 rounded-2xl shadow-2xl border border-orange-500/40 flex items-center gap-3 text-right" dir="rtl">
          <div className="w-8 h-8 bg-orange-500/20 text-orange-400 rounded-xl flex items-center justify-center text-lg shrink-0">
            ⏳
          </div>
          <div className="text-xs">
            <span className="font-bold block text-orange-400">מתנת ההצטרפות שלך מחכה בעגלה!</span>
            <span className="text-[10px] text-gray-300">
              ההטבה בתוקף ל-{promoConfig.welcome_days_valid || 7} ימים מיום הרשמתך
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
