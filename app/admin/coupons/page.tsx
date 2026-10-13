'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  const [code, setCode] = useState('');
  const [couponName, setCouponName] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');

  // הגדרות שורת המבצע העליונה (מעל סכום מינימום)
  const [thresholdActive, setThresholdActive] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState('399');
  const [thresholdType, setThresholdType] = useState('משלוח חינם');
  const [thresholdDiscountPercent, setThresholdDiscountPercent] = useState('10');
  const [thresholdBannerText, setThresholdBannerText] = useState('🎉 מבצע מיוחד: משלוח חינם בקנייה מעל ₪399!');
  const [announcementEndTime, setAnnouncementEndTime] = useState('');

  // הגדרות מבצע הצטרפות
  const [welcomeActive, setWelcomeActive] = useState(false);
  const [welcomeType, setWelcomeType] = useState('מתנה'); // מתנה או אחוזים
  const [welcomeGiftProductId, setWelcomeGiftProductId] = useState('');
  const [welcomeDiscountValue, setWelcomeDiscountValue] = useState('10');
  const [welcomeDaysValid, setWelcomeDaysValid] = useState('7');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // שליפת קופונים
    const { data: couponsData } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (couponsData) setCoupons(couponsData);

    // שליפת מוצרים לחיפוש ובחירת מוצר מתנה (כולל תמונות)
    const { data: prodsData } = await supabase.from('products').select('id, name, image_url, images').order('name', { ascending: true });
    if (prodsData) setProductsList(prodsData);

    // שליפת הגדרות
    const { data: settingsData } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (settingsData) {
      setThresholdActive(!!settingsData.threshold_active);
      if (settingsData.threshold_amount) setThresholdAmount(settingsData.threshold_amount);
      if (settingsData.threshold_type) setThresholdType(settingsData.threshold_type);
      if (settingsData.threshold_discount_percent) setThresholdDiscountPercent(settingsData.threshold_discount_percent);
      if (settingsData.threshold_banner_text) setThresholdBannerText(settingsData.threshold_banner_text);
      
      if (settingsData.announcement_end_time) {
        const d = new Date(settingsData.announcement_end_time);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setAnnouncementEndTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      }

      if (settingsData.welcome_active !== undefined) setWelcomeActive(!!settingsData.welcome_active);
      if (settingsData.welcome_type) setWelcomeType(settingsData.welcome_type);
      if (settingsData.welcome_gift_product_id) setWelcomeGiftProductId(settingsData.welcome_gift_product_id);
      if (settingsData.welcome_discount_value) setWelcomeDiscountValue(settingsData.welcome_discount_value);
      if (settingsData.welcome_days_valid) setWelcomeDaysValid(settingsData.welcome_days_valid);
    }
  };

  const getProductImage = (p: any) => {
    if (!p) return '';
    if (p.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  const filteredProducts = productsList.filter(p => 
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedGiftProduct = productsList.find(p => p.id === welcomeGiftProductId);

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountValue) return alert('נא למלא את קוד הקופון וגובה ההנחה');

    const { error } = await supabase.from('coupons').insert([
      {
        code: code.trim().toUpperCase(),
        name: couponName.trim() || null,
        discount_type: discountType,
        discount_value: Number(discountValue)
      }
    ]);

    if (error) {
      alert('שגיאה ביצירת קופון (אולי הקוד כבר קיים): ' + error.message);
    } else {
      alert('הקופון נוצר בהצלחה! 🎟️');
      setCode('');
      setCouponName('');
      setDiscountValue('');
      fetchData();
    }
  };

  const handleSaveThresholdPromo = async () => {
    const promoData = {
      threshold_active: thresholdActive,
      threshold_amount: thresholdAmount,
      threshold_type: thresholdType,
      threshold_discount_percent: thresholdDiscountPercent,
      threshold_banner_text: thresholdBannerText,
      announcement_text: thresholdBannerText,
      announcement_end_time: announcementEndTime ? new Date(announcementEndTime).toISOString() : null
    };

    const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();

    let error;
    if (existing?.id) {
      const res = await supabase.from('settings').update(promoData).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('settings').insert([promoData]);
      error = res.error;
    }

    if (error) {
      alert('שגיאה בשמירת הגדרות המבצע: ' + error.message);
    } else {
      alert('הגדרות המבצע עודכנו בהצלחה! ✨');
      fetchData();
    }
  };

  const handleSaveWelcomePromo = async () => {
    const welcomeData = {
      welcome_active: welcomeActive,
      welcome_type: welcomeType,
      welcome_gift_product_id: welcomeGiftProductId || null,
      welcome_discount_value: welcomeDiscountValue,
      welcome_days_valid: Number(welcomeDaysValid) || 7
    };

    const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();

    let error;
    if (existing?.id) {
      const res = await supabase.from('settings').update(welcomeData).eq('id', existing.id);
      error = res.error;
    } else {
      const res = await supabase.from('settings').insert([welcomeData]);
      error = res.error;
    }

    if (error) {
      alert('שגיאה בשמירת מבצע הצטרפות: ' + error.message);
    } else {
      alert('הגדרות מבצע הצטרפות עודכנו בהצלחה! 🎁');
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק קופון זה?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8" dir="rtl">
      
      <div className="mb-2">
        <h1 className="text-2xl font-black text-gray-900">🎁 ניהול מבצעים וקופונים</h1>
      </div>

      {/* 1. מבצע קנייה מעל סכום מסוים */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border space-y-4">
        <h2 className="text-base sm:text-lg font-black text-gray-900 border-b pb-2">📢 מבצע קנייה מעל סכום מסוים (שורה עליונה)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סכום מינימום לקנייה (₪)</label>
            <input 
              type="number" 
              value={thresholdAmount} 
              onChange={(e) => setThresholdAmount(e.target.value)} 
              className="w-full border p-3 rounded-xl text-sm bg-gray-50/50 font-bold" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סוג המבצע</label>
            <select 
              value={thresholdType} 
              onChange={(e) => setThresholdType(e.target.value)}
              className="w-full border p-3 rounded-xl text-sm bg-white font-bold"
            >
              <option value="משלוח חינם">משלוח חינם</option>
              <option value="הנחה לפי אחוזים">הנחה לפי אחוזים</option>
            </select>
          </div>
          {thresholdType === 'הנחה לפי אחוזים' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">אחוז הנחה (%)</label>
              <input 
                type="number" 
                value={thresholdDiscountPercent} 
                onChange={(e) => setThresholdDiscountPercent(e.target.value)} 
                placeholder="למשל: 10"
                className="w-full border p-3 rounded-xl text-sm bg-white font-bold" 
              />
            </div>
          )}
        </div>

        {/* תיקון יציב של מסגרת התאריך והשעה */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תאריך ושעה לסיום אוטומטי ⏱️</label>
          <div className="w-full max-w-full overflow-hidden box-border">
            <input 
              type="datetime-local" 
              value={announcementEndTime} 
              onChange={(e) => setAnnouncementEndTime(e.target.value)} 
              className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white font-bold text-gray-800 outline-none focus:border-orange-500 block box-border" 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">טקסט השורה שתוצג בראש האתר</label>
          <input 
            type="text" 
            value={thresholdBannerText} 
            onChange={(e) => setThresholdBannerText(e.target.value)} 
            placeholder="למשל: 🎉 מבצע מיוחד: משלוח חינם בקנייה מעל ₪399!"
            className="w-full border p-3 rounded-xl text-sm font-medium" 
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input 
            type="checkbox" 
            id="threshActive"
            checked={thresholdActive} 
            onChange={(e) => setThresholdActive(e.target.checked)}
            className="w-4 h-4 accent-black rounded cursor-pointer"
          />
          <label htmlFor="threshActive" className="text-sm font-bold text-gray-800 cursor-pointer">
            הצג שורת מבצע בראש האתר (אם כבוי, השורה לא תוצג)
          </label>
        </div>

        <button 
          onClick={handleSaveThresholdPromo}
          className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
        >
          שמור הגדרות מבצע סכום קנייה 💾
        </button>
      </div>

      {/* 2. מבצע הצטרפות עם חיפוש מוצר ותצוגת תמונה */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border space-y-4">
        <h2 className="text-base sm:text-lg font-black text-gray-900 border-b pb-2">🎁 מבצע הצטרפות</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סוג מבצע הצטרפות</label>
            <select 
              value={welcomeType} 
              onChange={(e) => setWelcomeType(e.target.value)}
              className="w-full border p-3 rounded-xl text-sm bg-white font-bold"
            >
              <option value="מתנה">מתנה בהצטרפות</option>
              <option value="הנחה לפי אחוזים">הנחת אחוזים בהצטרפות</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">תוקף לאחר הרשמה (בימים)</label>
            <input 
              type="number" 
              value={welcomeDaysValid} 
              onChange={(e) => setWelcomeDaysValid(e.target.value)} 
              className="w-full border p-3 rounded-xl text-sm bg-white font-bold" 
            />
          </div>
        </div>

        {welcomeType === 'מתנה' ? (
          <div className="bg-gray-50 p-4 rounded-2xl border space-y-3">
            <label className="block text-xs font-bold text-gray-800">בחר מוצר מתנה מהחנות 🎁</label>
            
            {/* שדה חיפוש מוצר */}
            <input 
              type="text" 
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="🔍 חפש מוצר לפי שם..."
              className="w-full border p-2.5 rounded-xl text-xs bg-white"
            />

            <select 
              value={welcomeGiftProductId} 
              onChange={(e) => setWelcomeGiftProductId(e.target.value)}
              className="w-full border p-3 rounded-xl text-sm bg-white font-bold"
            >
              <option value="">-- בחר מוצר מתנה --</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* תצוגת המוצר שנבחר + התמונה שלו */}
            {selectedGiftProduct && (
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border mt-2">
                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border shrink-0">
                  {getProductImage(selectedGiftProduct) ? (
                    <img src={getProductImage(selectedGiftProduct)} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xl">🎁</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-orange-600 font-bold block">המוצר שנבחר כמתנה:</span>
                  <h4 className="text-xs font-black text-gray-900">{selectedGiftProduct.name}</h4>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">אחוז הנחה להצטרפות (%)</label>
            <input 
              type="number" 
              value={welcomeDiscountValue} 
              onChange={(e) => setWelcomeDiscountValue(e.target.value)} 
              className="w-full border p-3 rounded-xl text-sm bg-white font-bold" 
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <input 
            type="checkbox" 
            id="welcomeActive"
            checked={welcomeActive} 
            onChange={(e) => setWelcomeActive(e.target.checked)}
            className="w-4 h-4 accent-black rounded cursor-pointer"
          />
          <label htmlFor="welcomeActive" className="text-sm font-bold text-gray-800 cursor-pointer">
            הפעל פופ-אפ מבצע הצטרפות ללקוחות חדשים באתר 🌟
          </label>
        </div>

        <button 
          onClick={handleSaveWelcomePromo}
          className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
        >
          שמור הגדרות הצטרפות 💾
        </button>
      </div>

      {/* 3. הוספת קופון רגיל */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border">
        <h2 className="text-base sm:text-lg font-black text-gray-900 mb-4 border-b pb-2">➕ הוספת קופון חדש</h2>
        <form onSubmit={handleAddCoupon} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קוד קופון <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="לדוגמה: PESACH20"
                className="w-full border p-3 rounded-xl uppercase text-sm font-bold"
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">שם הקופון / יוצר (אופציונלי)</label>
              <input 
                type="text" 
                value={couponName} 
                onChange={(e) => setCouponName(e.target.value)} 
                placeholder="לדוגמה: קופון דניאל"
                className="w-full border p-3 rounded-xl text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">סוג הנחה</label>
              <select 
                value={discountType} 
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full border p-3 rounded-xl text-sm bg-white font-bold"
              >
                <option value="percent">אחוזים (%)</option>
                <option value="fixed">סכום קבוע (₪)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">גובה ההנחה <span className="text-red-500">*</span></label>
              <input 
                type="number" 
                value={discountValue} 
                onChange={(e) => setDiscountValue(e.target.value)} 
                placeholder="לדוגמה: 15"
                className="w-full border p-3 rounded-xl text-sm font-bold"
                required 
              />
            </div>
          </div>

          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition cursor-pointer">
            צור קופון חדש ✨
          </button>
        </form>
      </div>

      {/* רשימת קופונים קיימים */}
      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 font-bold text-sm">קופונים קיימים במערכת ({coupons.length})</div>
        {coupons.length === 0 ? (
          <p className="p-6 text-center text-gray-500">אין קופונים פעילים כרגע.</p>
        ) : (
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-gray-500 text-xs">
                <th className="p-4">קוד קופון</th>
                <th className="p-4">שם / יוצר</th>
                <th className="p-4">הנחה</th>
                <th className="p-4">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b hover:bg-gray-50/50">
                  <td className="p-4 font-black">{coupon.code}</td>
                  <td className="p-4 text-gray-700 font-medium">{coupon.name || <span className="text-gray-400 italic">ללא שם</span>}</td>
                  <td className="p-4 font-bold">{coupon.discount_value}{coupon.discount_type === 'percent' ? '%' : '₪'}</td>
                  <td className="p-4">
                    <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer">
                      מחק 🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
