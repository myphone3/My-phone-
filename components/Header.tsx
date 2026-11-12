'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Icon from './Icon';
import CategoriesMenu from './CategoriesMenu';
import SearchBox from './SearchBox';
import { usePathname } from 'next/navigation';
import { COMPARE_EVENT, getCompare } from '@/lib/shop';

// כמה זמן אחרי הכניסה לאתר מוצג פופאפ ההצטרפות (רק פעם אחת בביקור)
const WELCOME_DELAY_MS = 20000;

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  // מונה שעולה בכל הוספה לעגלה, כדי להפעיל מחדש את קפיצת האייקון
  const [cartBump, setCartBump] = useState(0);
  const lastCartCount = useRef<number | null>(null);
  
  const [promoConfig, setPromoConfig] = useState<any>(null);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [hasUsedPromo, setHasUsedPromo] = useState(false);
  
  // ניהול הפופאפ המרכזי
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  // חלון ההרשמה (נפתח מכל כפתור "הרשמה"), עם אפשרות לאשר קבלת עדכונים ומבצעים
  const [signupOpen, setSignupOpen] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  // הבחירה הנוכחית של לקוח מחובר (null = עוד לא נטען / לא זמין)
  const [mySubscribed, setMySubscribed] = useState<boolean | null>(null);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);

  // התראות שהלקוח סימן כנקראו (נשמר במכשיר שלו)
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // כמה מוצרים בהשוואה (מוצג באזור האישי)
  const [compareCount, setCompareCount] = useState(0);
  useEffect(() => {
    const update = () => setCompareCount(getCompare().length);
    update();
    window.addEventListener(COMPARE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(COMPARE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const welcomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        try {
          const saved = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
          if (Array.isArray(saved)) setDismissedIds(saved);
        } catch {
          // ignore
        }

        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        setUser(currentUser);

        if (currentUser) {
          checkAdmin();
          checkUserOrders(currentUser.email);
          syncMarketingConsent();
        } else {
          // אם המשתמש לא מחובר, נבדוק אם כבר ראה את הפופאפ בסשן הנוכחי
          // הפופאפ לא קופץ מיד: נותנים ללקוח קודם להכיר את החנות
          const hasSeenWelcome = sessionStorage.getItem('seenWelcomeModal');
          if (!hasSeenWelcome) {
            welcomeTimer.current = setTimeout(() => setShowWelcomeModal(true), WELCOME_DELAY_MS);
          }
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
        checkAdmin();
        checkUserOrders(currentUser.email);
        syncMarketingConsent();
        setShowWelcomeModal(false); // סגירת הפופאפ אם התחבר
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
        if (lastCartCount.current !== null && totalItems > lastCartCount.current) setCartBump((n) => n + 1);
        lastCartCount.current = totalItems;
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);
    // כפתורים אחרים באתר (למשל "כתבו ביקורת") יכולים לפתוח את חלון ההרשמה
    const openSignup = () => setSignupOpen(true);
    window.addEventListener('open-signup', openSignup);
    // עמודים אחרים (למשל סיום השאלון) מסמנים התראה כנקראה
    const reloadDismissed = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
        if (Array.isArray(saved)) setDismissedIds(saved);
      } catch {
        // ignore
      }
    };
    window.addEventListener('notificationsUpdated', reloadDismissed);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (welcomeTimer.current) clearTimeout(welcomeTimer.current);
      subscription.unsubscribe();
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
      window.removeEventListener('open-signup', openSignup);
      window.removeEventListener('notificationsUpdated', reloadDismissed);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // בדיקת מנהל: שואלים את בסיס הנתונים (הפונקציה is_admin) האם המשתמש המחובר ברשימת המנהלים
  const checkAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      setIsAdmin(!error && data === true);
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

  // אחרי חזרה מגוגל: אם הלקוח סימן בחלון ההרשמה שהוא רוצה מבצעים, שומרים את זה.
  // (תיבה לא מסומנת לא מבטלת הסכמה קיימת, כי גם לקוח ותיק נכנס דרך אותו חלון)
  const syncMarketingConsent = async () => {
    try {
      const pending = JSON.parse(localStorage.getItem('np_marketing_consent') || 'null');
      if (!pending || pending.consent !== true || Date.now() - Number(pending.at) >= 10 * 60 * 1000) {
        localStorage.removeItem('np_marketing_consent');
      } else {
        // הבחירה תקפה 10 דקות בלבד (זמן ההתחברות עם גוגל), ונמחקת רק אחרי שנשמרה
        const { error } = await supabase.rpc('set_my_marketing_consent', { p_consent: true, p_source: 'signup' });
        if (!error) localStorage.removeItem('np_marketing_consent');
      }
    } catch {
      // ignore
    }
    const { data, error } = await supabase.rpc('get_my_marketing_consent');
    setMySubscribed(error ? null : !!data);
  };

  // מתג "מבצעים במייל" בתפריט האישי
  // שינוי אחד בכל פעם: עד שהשמירה מסתיימת המתג נעול, כדי שבקשות לא יגיעו בסדר הפוך
  const toggleMySubscription = async () => {
    if (mySubscribed === null || subscriptionSaving) return;
    const next = !mySubscribed;
    setSubscriptionSaving(true);
    setMySubscribed(next);
    const { error } = await supabase.rpc('set_my_marketing_consent', { p_consent: next, p_source: 'menu' });
    if (error) setMySubscribed(!next);
    setSubscriptionSaving(false);
  };

  // כפתורי ההרשמה באתר פותחים את חלון ההרשמה
  const handleGoogleLogin = () => {
    setDropdownOpen(false);
    setSignupOpen(true);
  };

  // ההרשמה עצמה (מתוך החלון). הבחירה בעדכונים נשמרת עד שהלקוח חוזר מגוגל
  const startGoogleSignup = async () => {
    try {
      localStorage.setItem('np_marketing_consent', JSON.stringify({ consent: marketingConsent, at: Date.now() }));
    } catch {
      // ignore
    }
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

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
    setSignupOpen(false);
    sessionStorage.setItem('seenWelcomeModal', 'true');
  };

  // סימון התראה כנקראה (נשמר במכשיר)
  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem('dismissedNotifications', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const getProductImage = (p: any) => {
    if (!p) return '';
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  const isUserAdmin = isAdmin;

  // נתוני מבצע ההצטרפות מהגדרות הניהול
  const isGiftPromo = promoConfig?.welcome_type === 'מתנה';
  const welcomeMinPurchase = Number(promoConfig?.welcome_min_purchase) || 0;
  const welcomeDaysValid = Number(promoConfig?.welcome_days_valid) || 0;

  // כמה ימים נשארו ללקוח מחובר (נספר מיום ההרשמה שלו)
  const giftDaysLeft: number | null =
    user?.created_at && welcomeDaysValid > 0
      ? Math.ceil((new Date(user.created_at).getTime() + welcomeDaysValid * 86400000 - Date.now()) / 86400000)
      : null;
  const giftExpired = giftDaysLeft !== null && giftDaysLeft <= 0;

  // התראה 1: מתנת הצטרפות
  const hasGiftNotification =
    !!promoConfig?.welcome_active &&
    !dismissedIds.includes('gift') &&
    (!user || (!hasUsedPromo && !giftExpired));

  // התראה 2: תזכורת עגלה (חוזרת אם כמות המוצרים בעגלה השתנתה)
  const cartNotificationId = `cart:${cartCount}`;
  const hasCartNotification =
    cartCount > 0 && pathname !== '/cart' && !dismissedIds.includes(cartNotificationId);

  // (המלצת מכשיר עברה לנציג החכם: העיגול מעל הוואטסאפ, ולכן היא כבר לא התראה)
  const notificationsCount = (hasGiftNotification ? 1 : 0) + (hasCartNotification ? 1 : 0);

  // שורת פרטים קטנה בכרטיס המתנה
  const giftMetaParts: string[] = [];
  if (welcomeMinPurchase > 0) giftMetaParts.push(`בקנייה מעל ₪${welcomeMinPurchase}`);
  if (user && giftDaysLeft !== null) {
    giftMetaParts.push(giftDaysLeft === 1 ? 'נשאר יום אחד' : `נשארו ${giftDaysLeft} ימים`);
  } else if (welcomeDaysValid > 0) {
    giftMetaParts.push(`תקף ${welcomeDaysValid} ימים`);
  }

  // בפאנל הניהול לא מציגים את כותרת החנות (הבדיקה אחרי כל ה-hooks, אחרת המעבר חזרה לחנות קורס)
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* ===== פופאפ מרכזי קופץ באמצע המסך למשתמש לא מחובר ===== */}
      {!user && (signupOpen || (showWelcomeModal && promoConfig?.welcome_active && pathname !== '/cart')) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="הצטרפות ל-NEW PHONE"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseWelcomeModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCloseWelcomeModal(); }}
        >
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full text-center shadow-2xl relative border border-gray-100 max-h-[95vh] overflow-y-auto">
            
            <button
              onClick={handleCloseWelcomeModal}
              className="absolute top-3.5 left-3.5 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-sm transition cursor-pointer"
              aria-label="סגור"
            >
              ✕
            </button>

            <img src="/logo-160.jpg" alt="NEW PHONE" width={64} height={64} className="h-16 mx-auto object-contain" />
            <h3 className="text-xl font-black text-gray-900 pt-1 pb-3">הצטרפות ל-NEW PHONE</h3>

            {!promoConfig?.welcome_active ? null : isGiftPromo ? (
              <div className="space-y-3">
                <div className="w-full h-44 sm:h-48 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center overflow-hidden">
                  {getProductImage(giftProduct) ? (
                    <img src={getProductImage(giftProduct)} alt={giftProduct?.name || ''} className="w-full h-full object-contain p-2" />
                  ) : (
                    <Icon name="gift" size={64} className="text-orange-500" strokeWidth={1.3} />
                  )}
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900 leading-snug">{giftProduct?.name || 'מתנה מיוחדת'}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">במתנה בהרשמה</p>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl py-6 space-y-1">
                <p className="text-5xl font-black text-orange-600">{promoConfig?.welcome_discount_value}%</p>
                <p className="text-sm font-bold text-orange-900">הנחה על ההזמנה הראשונה</p>
              </div>
            )}

            {(welcomeMinPurchase > 0 || welcomeDaysValid > 0) && (
              <div className="flex items-center justify-center flex-wrap gap-2 mt-3">
                {welcomeMinPurchase > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 font-medium">
                    <Icon name="cart" size={14} />
                    <span>בקנייה מעל ₪{welcomeMinPurchase}</span>
                  </span>
                )}
                {welcomeDaysValid > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-600 font-medium">
                    <Icon name="clock" size={14} />
                    <span>תקף {welcomeDaysValid} ימים</span>
                  </span>
                )}
              </div>
            )}

            <ul className="mt-4 space-y-2 text-right">
              {[
                ['box', 'מעקב אחרי ההזמנות שלך במקום אחד'],
                ['sparkle', 'קנייה מהירה יותר בפעם הבאה'],
                ['bell', 'עדכון כשההזמנה בדרך אליך'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-gray-700 font-medium">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center"><Icon name={icon} size={16} /></span>
                  {text}
                </li>
              ))}
            </ul>

            <label className="mt-4 flex items-start gap-2.5 text-right bg-gray-50 border border-gray-200 rounded-2xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-orange-600 shrink-0"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                אני רוצה לקבל מבצעים והטבות במייל
                <span className="block text-[11px] text-gray-500">לא חובה. אפשר להסיר את עצמך בכל עת מהתפריט האישי באתר או מהקישור שבכל מייל.</span>
              </span>
            </label>

            <div className="pt-4">
              <button
                onClick={startGoogleSignup}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3.5 rounded-2xl text-sm transition shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span className="bg-white p-1 rounded-full flex items-center justify-center w-5 h-5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </span>
                <span>{!promoConfig?.welcome_active ? 'הרשמה עם Google' : isGiftPromo ? 'קבלו את המתנה שלכם' : 'קבלו את ההנחה שלכם'}</span>
              </button>
              <p className="text-xs text-gray-500 font-medium mt-1.5">ההרשמה לוקחת שניות, עם חשבון Google</p>
              <p className="text-[11px] text-gray-400 mt-1">
                בהרשמה את/ה מסכים/ה ל<Link href="/terms" onClick={handleCloseWelcomeModal} className="underline">תקנון</Link> ול<Link href="/privacy" onClick={handleCloseWelcomeModal} className="underline">מדיניות הפרטיות</Link>
              </p>

              <button
                onClick={handleCloseWelcomeModal}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 transition cursor-pointer pt-3"
              >
                אולי בפעם אחרת
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===== תפריט עליון (Header) ===== */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 pt-4 pb-4 space-y-3.5">
          
          {/* שורה עליונה */}
          <div className="flex items-center justify-between relative pt-1 pb-1">
            
            {/* צד שמאל: כפתור פרופיל והתראות עם אינדיקטור בולט */}
            <div className="relative z-10 flex items-center ml-2" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="האזור האישי"
                aria-expanded={dropdownOpen}
                className="relative flex items-center justify-center w-12 h-12 bg-white hover:bg-orange-50/50 border-2 border-orange-200 rounded-full shadow-2xs transition duration-200 cursor-pointer p-1"
                title={user ? (user.user_metadata?.full_name || 'החשבון שלי') : 'הרשמה לאתר והתראות'}
              >
                <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : user ? (
                    <span className="w-full h-full bg-orange-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </span>
                  )}
                </span>

                {/* מספר ההתראות שלא נקראו */}
                {notificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-orange-600 border-2 border-white text-[10px] text-white font-black items-center justify-center">
                      {notificationsCount}
                    </span>
                  </span>
                )}
              </button>


              {/* חלונית נפתחת */}
              {dropdownOpen && (
                <div className="absolute top-16 right-0 z-50 w-80 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 space-y-3 animate-in fade-in zoom-in duration-150">
                  
                  <div className="flex items-center justify-between border-b pb-2.5">
                    <span className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                      <Icon name="user" size={16} className="text-orange-600" />
                      <span>האזור האישי</span>
                    </span>
                    <button 
                      onClick={() => setDropdownOpen(false)}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* לקוח לא מחובר: כפתור התחברות */}
                  {!user && (
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
                      <span>הרשמה לאתר עם Google</span>
                    </button>
                  )}

                  {/* לקוח מחובר: פרטי המשתמש */}
                  {user && (
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
                  )}

                  {/* לקוח מחובר: הרשמה / הסרה ממבצעים במייל */}
                  {user && mySubscribed !== null && (
                    <label className="flex items-center justify-between gap-3 bg-white border rounded-2xl p-3 cursor-pointer">
                      <span className="text-xs">
                        <span className="font-bold text-gray-900 flex items-center gap-1.5"><Icon name="mail" size={14} /> מבצעים והטבות במייל</span>
                        <span className="text-gray-500">{mySubscribed ? 'את/ה ברשימה. אפשר לבטל בכל עת.' : 'לא נשלח לך מבצעים במייל.'}</span>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={mySubscribed}
                        disabled={subscriptionSaving}
                        onChange={toggleMySubscription}
                        className="w-5 h-5 accent-orange-600 shrink-0"
                      />
                    </label>
                  )}

                  {/* ===== הכלים שלי ===== */}
                  <div className="grid grid-cols-2 gap-2">
                    {user ? (
                      <Link
                        href="/cart?tab=orders"
                        onClick={() => {
                          setDropdownOpen(false);
                          // אם כבר בעמוד העגלה, מעבירים אותו ללשונית ההזמנות
                          window.dispatchEvent(new Event('showMyOrders'));
                        }}
                        className="bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-2xl p-3 text-right transition"
                      >
                        <Icon name="box" size={22} className="text-orange-600" />
                        <span className="block text-xs font-black text-gray-900 mt-1">ההזמנות שלי</span>
                        <span className="block text-[10px] text-gray-500">מעקב ומצב משלוח</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-2xl p-3 text-right transition cursor-pointer"
                      >
                        <Icon name="box" size={22} className="text-orange-600" />
                        <span className="block text-xs font-black text-gray-900 mt-1">ההזמנות שלי</span>
                        <span className="block text-[10px] text-gray-500">אחרי התחברות</span>
                      </button>
                    )}
                    <Link
                      href="/compare"
                      onClick={() => setDropdownOpen(false)}
                      className="relative bg-white hover:bg-orange-50 border-2 border-orange-100 hover:border-orange-200 rounded-2xl p-3 text-right transition"
                    >
                      {compareCount > 0 && (
                        <span className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-black min-w-5 h-5 px-1 rounded-full flex items-center justify-center">{compareCount}</span>
                      )}
                      <Icon name="compare" size={22} className="text-orange-600" />
                      <span className="block text-xs font-black text-gray-900 mt-1">השוואת מוצרים</span>
                      <span className="block text-[10px] text-gray-500">{compareCount > 0 ? `${compareCount} מוצרים בהשוואה` : 'שמים מכשירים זה לצד זה'}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        window.dispatchEvent(new Event('openAssistant'));
                      }}
                      className="bg-white hover:bg-orange-50 border-2 border-orange-100 hover:border-orange-200 rounded-2xl p-3 text-right transition cursor-pointer"
                    >
                      <Icon name="bot" size={22} className="text-orange-600" />
                      <span className="block text-xs font-black text-gray-900 mt-1">איזה מכשיר מתאים לי?</span>
                      <span className="block text-[10px] text-gray-500">הנציג החכם ימליץ</span>
                    </button>
                    <Link
                      href="/guide"
                      onClick={() => setDropdownOpen(false)}
                      className="bg-white hover:bg-orange-50 border-2 border-orange-100 hover:border-orange-200 rounded-2xl p-3 text-right transition"
                    >
                      <Icon name="book" size={22} className="text-orange-600" />
                      <span className="block text-xs font-black text-gray-900 mt-1">מדריכים</span>
                      <span className="block text-[10px] text-gray-500">כשר, תומך כשר וגרסאות</span>
                    </Link>
                  </div>

                  {/* ===== רשימת התראות ===== */}
                  <div className="space-y-2">
                    {(hasGiftNotification || hasCartNotification) && (
                      <span className="flex items-center gap-1.5 text-[11px] font-black text-gray-500 pt-1">
                        <Icon name="bell" size={13} /> התראות
                      </span>
                    )}
                    {hasGiftNotification && (
                      <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-orange-900 flex items-center gap-1">
                            <Icon name="gift" size={14} />
                            <span>{user ? 'יש לך מתנת הצטרפות' : 'מתנת הצטרפות'}</span>
                          </span>
                          <button
                            onClick={() => dismissNotification('gift')}
                            className="text-[10px] text-gray-500 hover:text-gray-700 font-bold cursor-pointer shrink-0"
                          >
                            סמן כנקרא ✓
                          </button>
                        </div>

                        {isGiftPromo && giftProduct ? (
                          <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-orange-100">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border shrink-0">
                              {getProductImage(giftProduct) ? (
                                <img src={getProductImage(giftProduct)} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <Icon name="gift" size={14} />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-extrabold text-gray-900 block truncate">{giftProduct.name}</span>
                              {giftMetaParts.length > 0 && (
                                <span className="text-[10px] text-gray-500 font-medium block">{giftMetaParts.join(' | ')}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-orange-800 font-bold">
                              {promoConfig?.welcome_discount_value}% הנחה על ההזמנה הראשונה
                            </p>
                            {giftMetaParts.length > 0 && (
                              <p className="text-[10px] text-gray-500 font-medium mt-0.5">{giftMetaParts.join(' | ')}</p>
                            )}
                          </div>
                        )}

                        <div className="pt-1 border-t border-orange-200/50">
                          {user ? (
                            <Link
                              href="/cart"
                              onClick={() => setDropdownOpen(false)}
                              className="text-xs font-bold text-orange-700 hover:underline cursor-pointer"
                            >
                              למימוש בעגלה ←
                            </Link>
                          ) : (
                            <button
                              onClick={handleGoogleLogin}
                              className="text-xs font-bold text-orange-700 hover:underline cursor-pointer"
                            >
                              הרשמה עם Google ➔
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {hasCartNotification && (
                      <div className="bg-orange-50 border border-orange-200/80 rounded-2xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-orange-900 flex items-center gap-1">
                            <Icon name="cart" size={14} />
                            <span>שכחת משהו בעגלה</span>
                          </span>
                          <button
                            onClick={() => dismissNotification(cartNotificationId)}
                            className="text-[10px] text-gray-500 hover:text-gray-700 font-bold cursor-pointer shrink-0"
                          >
                            סמן כנקרא ✓
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 font-medium">
                          {cartCount === 1 ? 'יש לך מוצר אחד שמחכה לך בעגלה' : `יש לך ${cartCount} מוצרים שמחכים לך בעגלה`}
                        </p>
                        <div className="pt-1 border-t border-orange-200/50">
                          <Link
                            href="/cart"
                            onClick={() => setDropdownOpen(false)}
                            className="text-xs font-bold text-orange-700 hover:underline cursor-pointer"
                          >
                            לעגלה ←
                          </Link>
                        </div>
                      </div>
                    )}

                    {notificationsCount === 0 && (
                      <p className="text-center text-[11px] text-gray-400 font-medium pt-1">אין התראות חדשות</p>
                    )}
                  </div>

                  {user && isUserAdmin && (
                    <a
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full bg-black hover:bg-gray-800 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Icon name="tools" size={16} /><span>פאנל ניהול אתר</span>
                    </a>
                  )}

                  {user && (
                    <button
                      onClick={handleLogout}
                      className="w-full bg-gray-100 hover:bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs transition cursor-pointer text-center"
                    >
                      <span className="inline-flex items-center gap-1.5"><Icon name="logout" size={14} /> התנתק מהחשבון</span>
                    </button>
                  )}

                </div>
              )}
            </div>

            {/* אמצע: לוגו */}
            <Link href="/" className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer group shrink-0">
              <img src="/logo-160.jpg" alt="NEW PHONE - לדף הבית" width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 object-contain group-hover:scale-105 transition" />
            </Link>

            {/* צד ימין: עגלה */}
            <div className="flex items-center gap-2 shrink-0">
            <Link 
              href="/cart" 
              aria-label={cartCount > 0 ? `עגלת קניות, ${cartCount} מוצרים` : 'עגלת קניות'}
              className="relative p-2 bg-orange-50/40 hover:bg-orange-50 border-2 border-orange-200 text-orange-700 rounded-xl transition shadow-2xs flex items-center justify-center shrink-0 font-bold ml-2 cursor-pointer"
              title="עגלה"
            >
              <span key={`c${cartBump}`} className={cartBump ? 'cart-bump inline-flex' : 'inline-flex'}>
                <Icon name="cart" size={22} />
              </span>
              {cartCount > 0 && (
                <span key={`n${cartBump}`} className={`${cartBump ? 'cart-count-pop ' : ''}absolute -top-2 -right-2 bg-orange-600 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-black border-2 border-white shadow-md`}>
                  {cartCount}
                </span>
              )}
            </Link>
            </div>

          </div>

          {/* שורה תחתונה: חיפוש */}
          <div className="flex items-stretch gap-2 pt-2">
          <CategoriesMenu />
          <SearchBox />
          </div>

        </div>
      </header>
    </>
  );
}
