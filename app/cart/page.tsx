'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // קופונים ומבצעים
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  
  // מבצע סכום קנייה (משלוח חינם)
  const [thresholdPromo, setThresholdPromo] = useState<any>(null);

  // חלון התראה ללקוח חדש (קופון הצטרפות)
  const [welcomeCoupon, setWelcomeCoupon] = useState<any>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

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

  const fetchPromos = async () => {
    const { data: promoData } = await supabase.from('settings').select('*').eq('key', 'threshold_promo').single();
    if (promoData && promoData.value && promoData.value.active) {
      setThresholdPromo(promoData.value);
    }

    const { data: welcomeData } = await supabase
      .from('coupons')
      .select('*')
      .or('is_welcome.eq.true,is_welcome_gift.eq.true')
      .limit(1)
      .single();

    if (welcomeData) {
      setWelcomeCoupon(welcomeData);
      const dismissed = localStorage.getItem('welcome_modal_dismissed');
      if (!dismissed) {
        setShowWelcomeModal(true);
      }
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

  const thresholdMin = Number(thresholdPromo?.amount) || 400;
  const isFreeShippingEligible = thresholdPromo?.active && subtotalPrice >= thresholdMin;
  const shippingCost = isFreeShippingEligible ? 0 : 29;

  const totalPrice = Math.max(0, subtotalPrice - discountAmount + shippingCost);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !email || !city || !street || !building) {
      alert('נא למלא את כל שדות חובה (שם, טלפון, מייל, עיר, רחוב ומספר בניין)');
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
      address: `${city}, ${street} ${building}`,
      notes,
      items: cartItems,
      subtotal: subtotalPrice,
      discount_amount: discountAmount,
      coupon_code: appliedCoupon?.code || null,
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
      alert('ההזמנה בוצעה בהצלחה! צוות NEW PHONE יצור איתך קשר בהקדם.');
      localStorage.removeItem('cart');
      setCartItems([]);
      window.dispatchEvent(new Event('cartUpdated'));
      window.location.href = '/';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
        עגלת קניות והשלמת הזמנה
      </h1>

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
      ) : (
        <div className="space-y-6">
          {/* רשימת המוצרים בעגלה */}
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

          {/* שדה הזנת קוד קופון */}
          <div className="bg-white rounded-3xl border p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-gray-800">🎟️ יש לך קוד קופון?</h3>
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

          {/* טופס פרטי לקוח וסיום הזמנה */}
          <form onSubmit={handleCheckout} className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
            <h3 className="font-black text-sm border-r-4 border-orange-600 pr-2">פרטי לקוח וכתובת למשלוח</h3>
            
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
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">עיר <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="תל אביב"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">רחוב <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="הרצל"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">מספר בניין <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="12"
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

            {/* סיכום כספי מפורט */}
            <div className="border-t pt-4 space-y-2 text-xs">
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition shadow-md cursor-pointer"
            >
              {submitting ? 'שולח הזמנה...' : 'אישור הזמנה ותשלום ➔'}
            </button>
          </form>
        </div>
      )}

      {/* פופ-אפ התראה ללקוח חדש (מבצע הצטרפות בהרשמה) */}
      {showWelcomeModal && welcomeCoupon && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-2xl">
              🎁
            </div>
            <h3 className="text-lg font-black text-gray-900">ברוך הבא ל-NEW PHONE!</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              הרשם כעת לאתר וקבל קופון הצטרפות מיוחד: <br />
              <strong className="text-orange-600 text-sm">{welcomeCoupon.code}</strong> המקנה הנחה בהזמנה הראשונה שלך!
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCouponInput(welcomeCoupon.code);
                  setShowWelcomeModal(false);
                  localStorage.setItem('welcome_modal_dismissed', 'true');
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                השתמש בקופון עכשיו ⚡
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWelcomeModal(false);
                  localStorage.setItem('welcome_modal_dismissed', 'true');
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-2xl text-xs font-bold transition cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
