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

  if (!promoConfig || !promoConfig.welcome_active) return null;

  // תרחיש 1: אורח לא מחובר -> התראה בצד ימין למעלה שמצביעה לכפתור ההתחברות עם Google
  if (!user) {
    return (
      <div className="absolute top-16 right-4 sm:right-8 z-50 animate-bounce duration-1000">
        <div className="relative bg-orange-600 text-white p-4 rounded-2xl shadow-2xl max-w-xs border-2 border-white text-right" dir="rtl">
          {/* חץ קטן שמצביע למעלה ימינה לעבר כפתור Google */}
          <div className="absolute -top-2 right-8 w-4 h-4 bg-orange-600 rotate-45 border-t-2 border-l-2 border-white"></div>
          
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🎁</span>
            <div className="space-y-1">
              <h4 className="font-black text-xs sm:text-sm">מגיע לך מתנת הצטרפות!</h4>
              <p className="text-[11px] leading-relaxed text-orange-100">
                {promoConfig.welcome_type === 'מתנה' ? (
                  <>התחבר עכשיו עם גוגל וקבל {giftProduct ? <strong className="underline font-bold text-white">{giftProduct.name}</strong> : 'מוצר מתנה'} בהזמנה הראשונה!</>
                ) : (
                  <>התחבר עכשיו עם גוגל וקבל <strong className="underline font-bold text-white">{promoConfig.welcome_discount_value}% הנחה</strong> להזמנה הראשונה!</>
                )}
              </p>
            </div>
          </div>
        </div>
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
