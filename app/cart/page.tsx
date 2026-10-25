'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import MyOrders from '@/components/MyOrders';
import { Order, formatMoney, orderItems, orderNumber, orderTotals, toOrderLine } from '@/lib/orders';

// מאגר ערים רחב להצעות חכמות (לא חובה לבחור מתוכו, אפשר להקליד חופשי)
const ISRAEL_CITIES = [
  "אופקים", "אור יהודה", "אור עקיבא", "אילת", "אלעד", "אריאל", "אשדוד", "אשקלון", 
  "באקה אל-גרבייה", "באר שבע", "בית שאן", "בית שמש", "ביתר עילית", "בני ברק", 
  "בת ים", "גבעתיים", "דימונה", "הוד השרון", "הרצליה", "חדרה", "חולון", "חיפה", 
  "טבריה", "טירה", "טמרה", "יבנה", "יהוד-מונוסון", "ירושלים", "כפר סבא", "כרמיאל", 
  "לוד", "מגדל העמק", "מודיעין-מכבים-רעות", "מודיעין עילית", "מעלות-תרשיחא", "נהריה", 
  "נס ציונה", "נצרת", "נשר", "נתניה", "סח'נין", "עכו", "עפולה", "ערד", "פתח תקווה", 
  "צפת", "קריית אתא", "קריית ביאליק", "קריית גת", "קריית מוצקין", 
  "קריית אונו", "קריית שמונה", "ראש העין", "ראשון לציון", "רהט", "רחובות", "רמלה", 
  "רמת גן", "רמת השרון", "רעננה", "שדרות", "תל אביב - יפו"
];

// מאגר רחובות נפוצים להצעות חכמות
const ISRAEL_STREETS = [
  "הרצל", "ז'בוטינסקי", "בן גוריון", "רבי עקיבא", "חזון איש", "דיזנגוף", 
  "אבן גבירול", "אלנבי", "שדרות רוטשילד", "ויצמן", "הנשיא", "ירושלים", 
  "העצמאות", "ארלוזורוב", "סוקולוב", "ביאליק", "ההגנה", "יצחק רבין", 
  "שדרות ירושלים", "הירקון", "מנחם בגין", "הפלמ\"ח", "האורגים", "המלכים",
  "השרון", "הכרמל", "הגלבוע", "החרמון", "התאנה", "הזית", "הגפן", "אוסישקין"
];

export default function CartPage() {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [cartItems, setCartItems] = useState<any[]>([]);

  // לשונית פעילה: העגלה או ההזמנות שלי (נשמרת בכתובת: /cart?tab=orders)
  const [view, setView] = useState<'cart' | 'orders'>('cart');
  // ההזמנה שהושלמה עכשיו, למסך הסיום
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // פרטי לקוח וכתובת חופשיים לגמרי
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [notes, setNotes] = useState('');

  // הצעות סינון חיות בזמן אמת
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showCityList, setShowCityList] = useState(false);
  const [showStreetList, setShowStreetList] = useState(false);

  // פרטי אשראי
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolderId, setCardHolderId] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // קופונים ומבצעים
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  
  // הגדרות מערכת
  const [settings, setSettings] = useState<any>(null);

  // מתנת / הנחת הצטרפות (ההגדרות מהפאנל, והאם הלקוח זכאי)
  const [welcomePromo, setWelcomePromo] = useState<any>(null);
  const [giftProduct, setGiftProduct] = useState<any>(null);
  const [customer, setCustomer] = useState<{ email: string; createdAt: string } | null>(null);
  const [hasPastOrders, setHasPastOrders] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setCartItems(JSON.parse(saved));
      } catch (e) {
        setCartItems([]);
      }
    }
    fetchPromos();
    if (new URLSearchParams(window.location.search).get('tab') === 'orders') {
      setView('orders');
    }
    const showOrders = () => {
      setView('orders');
      setPlacedOrder(null);
    };
    window.addEventListener('showMyOrders', showOrders);
    return () => window.removeEventListener('showMyOrders', showOrders);
  }, []);

  const switchView = (next: 'cart' | 'orders') => {
    setView(next);
    setPlacedOrder(null);
    window.history.replaceState(null, '', next === 'orders' ? '/cart?tab=orders' : '/cart');
  };

  // חיפוש ערים חכם להשלמה (לא מגביל הקלדה חופשית)
  const handleCityChange = (val: string) => {
    setCity(val);
    if (val.trim().length > 0) {
      const matches = ISRAEL_CITIES.filter(c => c.includes(val.trim()));
      setCitySuggestions(matches);
      setShowCityList(true);
    } else {
      setCitySuggestions([]);
      setShowCityList(false);
    }
  };

  // חיפוש רחובות חכם להשלמה
  const handleStreetChange = (val: string) => {
    setStreet(val);
    if (val.trim().length > 0) {
      const matches = ISRAEL_STREETS.filter(s => s.includes(val.trim()));
      setStreetSuggestions(matches);
      setShowStreetList(true);
    } else {
      setStreetSuggestions([]);
      setShowStreetList(false);
    }
  };

  useEffect(() => {
    if (!settings?.announcement_end_time) return;
    const targetTime = new Date(settings.announcement_end_time).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [settings]);

  const fetchPromos = async () => {
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (settingsData) {
      setSettings(settingsData);
      try {
        const promo = JSON.parse(settingsData.announcement_text || '');
        if (promo?.welcome_active) {
          setWelcomePromo(promo);
          if (promo.welcome_type === 'מתנה' && promo.welcome_gift_product_id) {
            const { data: prod } = await supabase
              .from('products')
              .select('id, name, price, sale_price, image_url, images')
              .eq('id', promo.welcome_gift_product_id)
              .maybeSingle();
            if (prod) setGiftProduct(prod);
          }
        }
      } catch {
        // אין מבצע הצטרפות מוגדר
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user?.email) {
      setCustomer({ email: user.email, createdAt: user.created_at });
      const { data: past } = await supabase.from('orders').select('id').ilike('email', user.email).limit(1);
      setHasPastOrders(!!past && past.length > 0);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cartItems];
    updated[index].quantity = (updated[index].quantity || 1) + delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const removeItem = (index: number) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError('');

    // בדיקת קוד אחד בבסיס הנתונים, בלי לחשוף את רשימת כל הקופונים
    const { data, error } = await supabase
      .rpc('validate_coupon', { p_code: couponInput.trim() })
      .maybeSingle<any>();

    if (error || !data) {
      setCouponError('קופון שגוי או שאינו בתוקף');
      setAppliedCoupon(null);
    } else {
      setAppliedCoupon(data);
      setCouponError('');
      alert(`הקופון "${data.code}" הופעל בהצלחה! 🎉`);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  const subtotalPrice = cartItems.reduce((sum, item) => {
    const price = item.sale_price || item.price || 0;
    return sum + price * (item.quantity || 1);
  }, 0);

  let discountAmount = 0;
  if (appliedCoupon) {
    const val = Number(appliedCoupon.discount_value) || 0;
    const type = appliedCoupon.discount_type;
    if (type === 'percentage' || type === 'percent') {
      discountAmount = (subtotalPrice * val) / 100;
    } else {
      discountAmount = val;
    }
  }

  const isPromoActive = settings?.threshold_active && 
    (!settings?.announcement_end_time || (timeLeft && !timeLeft.isExpired));

  const thresholdMin = Number(settings?.threshold_amount) || 400;
  const isFreeShippingEligible = isPromoActive && subtotalPrice >= thresholdMin;
  const shippingCost = isFreeShippingEligible ? 0 : 29;

  // מבצע הצטרפות: מי זכאי ומה מציגים (החישוב הסופי נעשה שוב בבסיס הנתונים בזמן ההזמנה)
  const welcomeMin = Number(welcomePromo?.welcome_min_purchase) || 0;
  const welcomeDays = Number(welcomePromo?.welcome_days_valid) || 0;
  const welcomeDaysLeft =
    customer && welcomeDays > 0
      ? Math.ceil((new Date(customer.createdAt).getTime() + welcomeDays * 86400000 - Date.now()) / 86400000)
      : null;
  const isGiftType = welcomePromo?.welcome_type === 'מתנה';
  const welcomeOfferName = isGiftType ? giftProduct?.name || 'מתנה' : `${Number(welcomePromo?.welcome_discount_value) || 0}% הנחה`;
  const welcomeState: 'none' | 'register' | 'below' | 'eligible' = !welcomePromo || (isGiftType && !giftProduct)
    ? 'none'
    : !customer
      ? 'register'
      : hasPastOrders || (welcomeDaysLeft !== null && welcomeDaysLeft <= 0)
        ? 'none'
        : subtotalPrice < welcomeMin
          ? 'below'
          : 'eligible';
  const welcomeDiscount =
    welcomeState === 'eligible' && !isGiftType ? (subtotalPrice * (Number(welcomePromo?.welcome_discount_value) || 0)) / 100 : 0;
  const welcomeMeta = welcomeDaysLeft !== null ? (welcomeDaysLeft === 1 ? 'נשאר יום אחד' : `נשארו ${welcomeDaysLeft} ימים`) : '';

  const totalPrice = Math.max(0, subtotalPrice - Math.min(subtotalPrice, discountAmount + welcomeDiscount) + shippingCost);

  const handleWelcomeSignup = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // בדיקת שדות חובה רגילים (ללא הגבלה על תוכן הכתובת)
    if (!name || !phone || !email || !city.trim() || !street.trim() || !building.trim()) {
      alert('נא למלא את כל שדות החובה (שם, טלפון, אימייל, עיר, רחוב ומספר בניין)');
      return;
    }

    if (!cardNumber || cardNumber.length < 12 || !cardExpiry || !cardCvv || !cardHolderId) {
      alert('נא למלא את כל פרטי האשראי ותעודת הזהות להשלמת התשלום');
      return;
    }

    setSubmitting(true);

    // מפתח חד-פעמי לשליחת מייל האישור (לקוח לא יכול לקרוא הזמנות מהבסיס)
    const confirmationToken = crypto.randomUUID();

    // לבסיס הנתונים נשלח רק מה הלקוח רוצה. המחירים, ההנחות, המשלוח והמתנה מחושבים שם
    const { data: savedOrder, error } = await supabase.rpc('place_order', {
      p_items: cartItems.map(toOrderLine),
      p_customer: { name, phone, email, city, street, building, notes },
      p_coupon: appliedCoupon?.code || null,
      p_confirmation_token: confirmationToken,
    });

    setSubmitting(false);

    if (error || !savedOrder) {
      console.error('Supabase error:', error);
      alert('שגיאה בשליחת ההזמנה לשרת: ' + (error?.message || 'נסו שוב'));
    } else {
      const orderId = (savedOrder as Order).id;
      setPlacedOrder(savedOrder as Order);
      localStorage.removeItem('cart');
      setCartItems([]);
      setStep('cart');
      window.dispatchEvent(new Event('cartUpdated'));
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // מייל אישור עם PDF (אם נכשל, ההזמנה עדיין נשמרה)
      fetch('/api/order-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token: confirmationToken }),
        keepalive: true,
      }).catch((err) => console.error('Order confirmation email failed:', err));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">

      {/* לשוניות: העגלה שלי / ההזמנות שלי */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
        {([
          ['cart', '🛒 העגלה שלי'],
          ['orders', '📦 ההזמנות שלי'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchView(key)}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
              view === key && !(key === 'cart' && placedOrder) ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'orders' ? (
        <MyOrders />
      ) : placedOrder ? (

        /* === מסך סיום הזמנה === */
        <div className="bg-white rounded-3xl border border-orange-100 shadow-lg shadow-orange-100/60 p-6 sm:p-8 text-center max-w-lg mx-auto">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <img src="/Logo.JPG" alt="NEW PHONE" className="w-24 h-24 object-contain" />
            <div className="absolute -top-1 -left-2 w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white text-lg font-black flex items-center justify-center border-4 border-white shadow-md">
              ✓
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-1.5">התשלום בוצע בהצלחה!</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            תודה שקנית ב-NEW PHONE 🧡
            <br />
            אישור הזמנה נשלח למייל שלך.
          </p>
          <div className="inline-block bg-orange-50 border border-dashed border-orange-300 text-orange-700 font-black rounded-xl px-4 py-2 text-sm mb-5">
            מספר הזמנה: <span dir="ltr">#{orderNumber(placedOrder.id)}</span>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 text-sm text-right space-y-1.5 mb-5">
            {orderItems(placedOrder).map((item, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.qty}
                </span>
                <span className="whitespace-nowrap">
                  {item.gift ? (
                    <>
                      {item.original > 0 && <span className="line-through text-gray-400 text-xs ml-1.5">{formatMoney(item.original)}</span>}
                      <span className="text-green-600 font-bold">חינם</span>
                    </>
                  ) : (
                    formatMoney(item.total)
                  )}
                </span>
              </div>
            ))}
            {orderTotals(placedOrder).discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>הנחה</span>
                <span>-{formatMoney(orderTotals(placedOrder).discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>משלוח</span>
              <span>{orderTotals(placedOrder).shipping > 0 ? formatMoney(orderTotals(placedOrder).shipping) : 'חינם'}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-1 font-black text-orange-600 text-base">
              <span>סה״כ</span>
              <span>{formatMoney(orderTotals(placedOrder).total)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchView('orders')}
            className="block w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black transition cursor-pointer mb-2"
          >
            צפייה בהזמנות שלי
          </button>
          <Link
            href="/"
            className="block w-full bg-white border-2 border-orange-300 text-orange-700 hover:bg-orange-50 py-3 rounded-2xl text-sm font-black transition"
          >
            המשך קנייה
          </Link>
        </div>

      ) : (<>

      {/* כותרת ושלבים */}
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
          {step === 'cart' ? 'עגלת קניות' : 'קופה ותשלום אשראי'}
        </h1>

        {cartItems.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className={step === 'cart' ? 'text-orange-600 underline' : 'text-gray-400'}>1. עגלה</span>
            <span className="text-gray-300">➔</span>
            <span className={step === 'checkout' ? 'text-orange-600 underline' : 'text-gray-400'}>2. תשלום</span>
          </div>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-4 shadow-sm">
          <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            🛒
          </div>
          <h2 className="text-lg font-black text-gray-900">העגלה שלך ריקה</h2>
          <p className="text-xs text-gray-500 font-medium">עדיין לא הוספת מוצרים לעגלה</p>
          <Link href="/" className="inline-block bg-orange-600 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-orange-700 transition shadow-sm">
            🏠 למעבר לקטלוג
          </Link>
        </div>
      ) : step === 'cart' ? (
        
        /* === שלב 1: עגלת קניות === */
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border shadow-sm divide-y">
            {cartItems.map((item, index) => {
              const itemImg = item.image || item.image_url || (Array.isArray(item.images) ? item.images[0] : '') || '';
              const itemPrice = item.sale_price || item.price || 0;
              const qty = item.quantity || 1;

              return (
                <div key={index} className="p-4 sm:p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                      {itemImg ? (
                        <img src={itemImg} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <span>📦</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-xs sm:text-sm text-gray-900">{item.name}</h3>
                      {item.version && <span className="text-[10px] text-gray-500 block">גרסה: {item.version}</span>}
                      {item.color && <span className="text-[10px] text-gray-500 block">צבע: {item.color}</span>}
                      <p className="text-xs text-orange-600 font-bold mt-1">₪{itemPrice} ליחידה</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-xl bg-gray-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, -1)}
                        className="px-3 py-1 text-xs font-bold hover:bg-gray-200 transition cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-black">{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(index, 1)}
                        className="px-3 py-1 text-xs font-bold hover:bg-gray-200 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 text-xs font-bold p-2 cursor-pointer"
                      title="הסר מוצר"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}

            {/* מתנת הצטרפות שנוספת אוטומטית */}
            {welcomeState === 'eligible' && isGiftType && giftProduct && (
              <div className="p-4 sm:p-6 flex items-center justify-between gap-4 bg-gradient-to-l from-orange-50 to-white">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 bg-white rounded-2xl border flex items-center justify-center shrink-0">
                    {giftProduct.image_url || giftProduct.images?.[0] ? (
                      <img src={giftProduct.image_url || giftProduct.images?.[0]} alt={giftProduct.name} className="w-full h-full object-contain rounded-2xl" />
                    ) : (
                      <span>📦</span>
                    )}
                    <span className="absolute -top-2 -left-2 text-lg">🎁</span>
                  </div>
                  <div>
                    <span className="inline-block bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full mb-1">מתנת הצטרפות</span>
                    <h3 className="font-black text-xs sm:text-sm text-gray-900">{giftProduct.name}</h3>
                    <p className="text-[10px] text-orange-800 font-medium mt-0.5">
                      מתנה על ההזמנה הראשונה{welcomeMeta ? ` · ${welcomeMeta}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className="block text-[11px] text-gray-400 line-through">₪{giftProduct.sale_price || giftProduct.price}</span>
                  <span className="text-sm font-black text-green-600">חינם</span>
                </div>
              </div>
            )}
          </div>

          {/* חסר סכום למתנה / להנחה */}
          {welcomeState === 'below' && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
              <b className="text-sm font-black text-gray-900 block">
                🎁 עוד ₪{Math.ceil(welcomeMin - subtotalPrice)} ומקבלים {isGiftType ? 'מתנה' : 'הנחה'}!
              </b>
              <p className="text-[11px] text-gray-500">
                {isGiftType ? `${welcomeOfferName} במתנה` : welcomeOfferName} בקנייה מעל ₪{welcomeMin}
                {welcomeMeta ? ` · ${welcomeMeta}` : ''}
              </p>
              <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-orange-600 to-orange-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((subtotalPrice / Math.max(welcomeMin, 1)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* מבקר שלא נרשם */}
          {welcomeState === 'register' && (
            <div className="flex items-center gap-3 bg-white border-2 border-dashed border-orange-300 rounded-2xl p-4">
              <span className="text-3xl shrink-0">🎁</span>
              <div className="flex-1">
                <b className="text-sm font-black text-gray-900 block">מגיעה לך מתנה!</b>
                <span className="text-[11px] text-gray-500">
                  נרשמים לאתר ומקבלים {isGiftType ? `${welcomeOfferName} במתנה` : welcomeOfferName}
                  {welcomeMin > 0 ? ` בקנייה מעל ₪${welcomeMin}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={handleWelcomeSignup}
                className="bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-black px-3 py-2 rounded-xl whitespace-nowrap cursor-pointer"
              >
                הרשמה לאתר
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep('checkout')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span>המשך לתשלום</span>
            <span>➔</span>
          </button>
        </div>

      ) : (

        /* === שלב 2: עמוד התשלום === */
        <form onSubmit={handleCheckout} className="space-y-6">
          
          <button
            type="button"
            onClick={() => setStep('cart')}
            className="text-xs font-bold text-gray-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer"
          >
            ➔ חזרה לעריכת העגלה
          </button>

          {/* 1. פרטי לקוח וכתובת */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
            <h3 className="font-black text-sm border-r-4 border-orange-600 pr-2">1. פרטי לקוח וכתובת למשלוח</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">שם מלא <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ישראל ישראלי"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">טלפון נייד <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">כתובת אימייל <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              
              {/* שדה עיר עם הצעות חכמות והקלדה חופשית */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">עיר <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  onFocus={() => city.trim() && setShowCityList(true)}
                  placeholder="הקלד עיר חופשי..."
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600 font-bold"
                  required
                />
                
                {showCityList && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto divide-y">
                    {citySuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onTouchStart={() => {
                          setCity(item);
                          setShowCityList(false);
                        }}
                        onClick={() => {
                          setCity(item);
                          setShowCityList(false);
                        }}
                        className="p-3 text-xs font-bold text-gray-900 hover:bg-orange-50 bg-white cursor-pointer"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* שדה רחוב עם הצעות חכמות והקלדה חופשית מלאה */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">רחוב <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => handleStreetChange(e.target.value)}
                  onFocus={() => street.trim() && setShowStreetList(true)}
                  placeholder="הקלד רחוב חופשי..."
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600 font-bold"
                  required
                />

                {showStreetList && streetSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-xl shadow-2xl mt-1 max-h-48 overflow-y-auto divide-y">
                    {streetSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onTouchStart={() => {
                          setStreet(item);
                          setShowStreetList(false);
                        }}
                        onClick={() => {
                          setStreet(item);
                          setShowStreetList(false);
                        }}
                        className="p-3 text-xs font-bold text-gray-900 hover:bg-orange-50 bg-white cursor-pointer"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מספר דירה / בניין <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="דירה 4, קומה 2"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">הערות להזמנה (אופציונלי)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערות לשליח, קוד כניסה לבניין וכו'..."
                rows={2}
                className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
              ></textarea>
            </div>
          </div>

          {/* 2. קוד קופון */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
              <span>🎟️</span>
              <span>2. יש לך קוד קופון?</span>
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="הקלד קוד קופון כאן..."
                disabled={!!appliedCoupon}
                className="flex-1 bg-gray-50 border rounded-xl px-4 py-2.5 text-xs uppercase outline-none focus:border-orange-600 disabled:bg-gray-100"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  הסר קופון
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  הפעל קופון
                </button>
              )}
            </div>

            {couponError && <p className="text-[11px] text-red-500 font-bold">{couponError}</p>}
            {appliedCoupon && (
              <p className="text-[11px] text-green-600 font-bold">
                ✓ קופון "{appliedCoupon.code}" הופעל! מקנה הנחה של {appliedCoupon.discount_value}{appliedCoupon.discount_type === 'percentage' || appliedCoupon.discount_type === 'percent' ? '%' : '₪'}.
              </p>
            )}
          </div>

          {/* 3. פירוט מחירים ותשלום באשראי מאובטח */}
          <div className="bg-white rounded-3xl border p-6 shadow-sm space-y-5">
            <h3 className="font-black text-sm border-r-4 border-orange-600 pr-2">3. פירוט מחירים ותשלום באשראי מאובטח</h3>

            {/* פירוט המחירים */}
            <div className="space-y-2 text-xs bg-gray-50 p-4 rounded-2xl border">
              <div className="flex justify-between items-center text-gray-700">
                <span>סכום ביניים מוצרים:</span>
                <span className="font-bold text-gray-900">₪{subtotalPrice}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600 font-bold">
                  <span>הנחת קופון ({appliedCoupon?.code}):</span>
                  <span>-₪{discountAmount.toFixed(0)}</span>
                </div>
              )}

              {welcomeState === 'eligible' && isGiftType && giftProduct && (
                <div className="flex justify-between items-center text-green-600 font-bold">
                  <span>🎁 מתנת הצטרפות: {giftProduct.name}</span>
                  <span className="whitespace-nowrap">
                    <span className="line-through text-gray-400 font-medium ml-1.5">₪{giftProduct.sale_price || giftProduct.price}</span>
                    חינם
                  </span>
                </div>
              )}

              {welcomeDiscount > 0 && (
                <div className="flex justify-between items-center text-green-600 font-bold">
                  <span>🎁 הנחת הצטרפות ({Number(welcomePromo?.welcome_discount_value) || 0}%):</span>
                  <span>-₪{welcomeDiscount.toFixed(1)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-700">
                <span>עלות משלוח מהיר עד הבית:</span>
                {isFreeShippingEligible ? (
                  <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200">
                    חינם! (מבצע בקנייה מעל ₪{thresholdMin}) 🎉
                  </span>
                ) : (
                  <span className="font-bold text-gray-900">₪{shippingCost}</span>
                )}
              </div>

              <div className="border-t pt-2 flex justify-between items-center text-base font-black">
                <span className="text-gray-900">סה"כ לתשלום:</span>
                <span className="text-orange-600 text-lg">₪{totalPrice.toFixed(0)}</span>
              </div>
            </div>

            {/* שדות פרטי אשראי ותעודת זהות */}
            <div className="space-y-3 bg-orange-50/40 p-4 rounded-2xl border border-orange-100">
              <h4 className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                <span>💳</span>
                <span>הזנת פרטי כרטיס אשראי</span>
              </h4>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">מספר כרטיס אשראי <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="XXXX XXXX XXXX XXXX"
                  className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600 tracking-widest font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">תוקף (MM/YY) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600 text-center font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">CVV (3 ספרות בגב) <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="123"
                    className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600 text-center font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">תעודת זהות של בעל הכרטיס <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  maxLength={9}
                  value={cardHolderId}
                  onChange={(e) => setCardHolderId(e.target.value)}
                  placeholder="012345678"
                  className="w-full bg-white border rounded-xl p-3 text-xs outline-none focus:border-orange-600 font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{submitting ? 'מעבד תשלום...' : `שלם ₪${totalPrice.toFixed(0)} באשראי מאובטח 🔒`}</span>
            </button>
          </div>

        </form>

      )}

      </>)}

    </div>
  );
}
