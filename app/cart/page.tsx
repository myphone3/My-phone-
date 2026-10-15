'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function CartPage() {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [cartItems, setCartItems] = useState<any[]>([]);

  // פרטי לקוח וכתובת
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [notes, setNotes] = useState('');

  // ניהול הצעות חיות מהשרת
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([]);
  const [showCityList, setShowCityList] = useState(false);
  const [showStreetList, setShowStreetList] = useState(false);

  // פרטי אשראי ותעודת זהות
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
  }, []);

  // פונקציית חיפוש ערים חיה אונליין דרך השרת שלנו
  const handleCityInput = async (val: string) => {
    setCity(val);
    if (val.trim().length >= 2) {
      try {
        const res = await fetch(`/api/addresses?type=city&q=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data?.results) {
          setCitySuggestions(data.results);
          setShowCityList(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      setCitySuggestions([]);
      setShowCityList(false);
    }
  };

  // פונקציית חיפוש רחובות חיה אונליין בהתאם לעיר הנבחרת
  const handleStreetInput = async (val: string) => {
    setStreet(val);
    if (val.trim().length >= 2) {
      try {
        const res = await fetch(`/api/addresses?type=street&q=${encodeURIComponent(val)}&city=${encodeURIComponent(city)}`);
        const data = await res.json();
        if (data?.results) {
          setStreetSuggestions(data.results);
          setShowStreetList(true);
        }
      } catch (err) {
        console.error(err);
      }
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

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .ilike('code', couponInput.trim())
      .single();

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

  const totalPrice = Math.max(0, subtotalPrice - discountAmount + shippingCost);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !email || !city || !street || !building) {
      alert('נא למלא את כל שדות החובה (שם, טלפון, עיר, רחוב ומספר בניין)');
      return;
    }

    if (!cardNumber || cardNumber.length < 12 || !cardExpiry || !cardCvv || !cardHolderId) {
      alert('נא למלא את כל פרטי האשראי ותעודת הזהות להשלמת התשלום');
      return;
    }

    setSubmitting(true);
    
    const orderPayload = {
      customer_name: name,
      phone,
      email,
      city,
      street,
      building,
      address: `עיר: ${city}, רחוב: ${street}, מס' בניין/דירה: ${building}`,
      notes,
      payment_method: 'credit',
      items: cartItems,
      subtotal: subtotalPrice,
      discount_amount: discountAmount,
      shipping_cost: shippingCost,
      total_price: totalPrice,
      status: 'חדש'
    };

    const { error } = await supabase.from('orders').insert([orderPayload]);

    setSubmitting(false);

    if (error) {
      console.error('Supabase error:', error);
      alert('שגיאה בשליחת ההזמנה לשרת: ' + error.message);
    } else {
      alert('התשלום בוצע בהצלחה וההזמנה נקלטה! צוות NEW PHONE יצור איתך קשר בהקדם.');
      localStorage.removeItem('cart');
      setCartItems([]);
      window.dispatchEvent(new Event('cartUpdated'));
      window.location.href = '/';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      
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
          </div>

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
              
              {/* שדה עיר עם השלמה אונליין מהשרת */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">עיר <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => handleCityInput(e.target.value)}
                  placeholder="הקלד עיר..."
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
                {showCityList && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto divide-y">
                    {citySuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setCity(item);
                          setShowCityList(false);
                        }}
                        className="p-2.5 text-xs hover:bg-orange-50 cursor-pointer font-medium text-gray-800"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* שדה רחוב עם השלמה אונליין מהשרת */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">רחוב <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => handleStreetInput(e.target.value)}
                  placeholder="הקלד רחוב..."
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
                {showStreetList && streetSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto divide-y">
                    {streetSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setStreet(item);
                          setShowStreetList(false);
                        }}
                        className="p-2.5 text-xs hover:bg-orange-50 cursor-pointer font-medium text-gray-800"
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

    </div>
  );
}
