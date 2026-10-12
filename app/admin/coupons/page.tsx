'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [isWelcomeGift, setIsWelcomeGift] = useState(false);
  const [welcomeDaysValid, setWelcomeDaysValid] = useState('7');

  // הגדרות מבצע סכום קנייה ושורה מעל הבאנר
  const [thresholdActive, setThresholdActive] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState('400');
  const [thresholdType, setThresholdType] = useState('משלוח חינם');
  const [thresholdBannerText, setThresholdBannerText] = useState('🎉 מבצע מיוחד: משלוח חינם בהזמנה מעל 400₪!');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: couponsData } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (couponsData) setCoupons(couponsData);

    // שליפת הגדרות מבצע סכום קנייה מטבלת settings
    const { data: settingsData } = await supabase.from('settings').select('*').single();
    if (settingsData) {
      setThresholdActive(!!settingsData.threshold_active);
      if (settingsData.threshold_amount) setThresholdAmount(settingsData.threshold_amount);
      if (settingsData.threshold_type) setThresholdType(settingsData.threshold_type);
      if (settingsData.threshold_banner_text) setThresholdBannerText(settingsData.threshold_banner_text);
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountValue) return alert('נא למלא את כל השדות');

    const { error } = await supabase.from('coupons').insert([
      {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        is_welcome_gift: isWelcomeGift,
        welcome_days_valid: Number(welcomeDaysValid) || 7
      }
    ]);

    if (error) {
      alert('שגיאה ביצירת קופון (אולי הקוד כבר קיים): ' + error.message);
    } else {
      alert('הקופון נוצר בהצלחה! 🎟️');
      setCode('');
      setDiscountValue('');
      setIsWelcomeGift(false);
      setWelcomeDaysValid('7');
      fetchData();
    }
  };

  const handleSaveThresholdPromo = async () => {
    const promoData = {
      threshold_active: thresholdActive,
      threshold_amount: thresholdAmount,
      threshold_type: thresholdType,
      threshold_banner_text: thresholdBannerText
    };

    // שליפת מזהה השורה היחידה בטבלת settings לצורך עדכון
    const { data: existing } = await supabase.from('settings').select('id').limit(1).single();

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
      alert('הגדרות מבצע סכום קנייה והשורה מעל הבאנר עודכנו בהצלחה! ✨');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק קופון זה?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900">🎟️ ניהול קופונים ומבצעים</h1>
        <Link href="/admin/products" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-700">
          חזרה לניהול מוצרים 🔙
        </Link>
      </div>

      {/* 1. הגדרת מבצע קנייה מעל סכום ושורה מעל הבאנר */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
        <h2 className="text-lg font-bold border-b pb-2">📦 מבצע קנייה מעל סכום (כולל שורה מעל הבאנר)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סכום מינימום לקנייה (₪)</label>
            <input 
              type="number" 
              value={thresholdAmount} 
              onChange={(e) => setThresholdAmount(e.target.value)} 
              className="w-full border p-3 rounded-xl text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סוג המבצע</label>
            <select 
              value={thresholdType} 
              onChange={(e) => setThresholdType(e.target.value)}
              className="w-full border p-3 rounded-xl text-sm bg-white"
            >
              <option value="משלוח חינם">משלוח חינם</option>
              <option value="הנחה נוספת">הנחה נוספת</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input 
              type="checkbox" 
              id="threshActive"
              checked={thresholdActive} 
              onChange={(e) => setThresholdActive(e.target.checked)}
              className="w-4 h-4 accent-black rounded"
            />
            <label htmlFor="threshActive" className="text-sm font-medium text-gray-800">
              הפעל מבצע ושורה מעל הבאנר
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">טקסט השורה שתוצג מעל הבאנר באתר</label>
          <input 
            type="text" 
            value={thresholdBannerText} 
            onChange={(e) => setThresholdBannerText(e.target.value)} 
            placeholder="למשל: 🎉 משלוח חינם בקניה מעל 400₪!"
            className="w-full border p-3 rounded-xl text-sm" 
          />
        </div>

        <button 
          onClick={handleSaveThresholdPromo}
          className="bg-black text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
        >
          שמור הגדרות מבצע סכום 💾
        </button>
      </div>

      {/* 2. הוספת קופון רגיל / מתנת הצטרפות */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border">
        <h2 className="text-lg font-bold mb-4">➕ הוספת קופון חדש</h2>
        <form onSubmit={handleAddCoupon} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">קוד קופון</label>
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="לדוגמה: WELCOME10"
                className="w-full border p-3 rounded-xl uppercase text-sm font-bold"
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">סוג הנחה</label>
              <select 
                value={discountType} 
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full border p-3 rounded-xl text-sm bg-white"
              >
                <option value="percent">אחוזים (%)</option>
                <option value="fixed">סכום קבוע (₪)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">גובה ההנחה</label>
              <input 
                type="number" 
                value={discountValue} 
                onChange={(e) => setDiscountValue(e.target.value)} 
                placeholder="לדוגמה: 15"
                className="w-full border p-3 rounded-xl text-sm"
                required 
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 bg-gray-50 p-4 rounded-2xl border">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="welcomeGift"
                checked={isWelcomeGift} 
                onChange={(e) => setIsWelcomeGift(e.target.checked)}
                className="w-4 h-4 accent-black rounded"
              />
              <label htmlFor="welcomeGift" className="text-sm font-bold text-gray-800">
                הגדר כמתנת הצטרפות אוטומטית ללקוחות חדשים 🎁
              </label>
            </div>

            {isWelcomeGift && (
              <div className="w-full md:w-1/3">
                <label className="block text-xs font-bold text-gray-700 mb-1">תוקף הקופון לאחר הרשמה (בימים)</label>
                <input 
                  type="number" 
                  value={welcomeDaysValid} 
                  onChange={(e) => setWelcomeDaysValid(e.target.value)} 
                  placeholder="7"
                  className="w-full border p-2.5 rounded-xl text-sm bg-white" 
                />
              </div>
            )}
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
                <th className="p-4">הנחה</th>
                <th className="p-4">סוג קופון</th>
                <th className="p-4">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b hover:bg-gray-50/50">
                  <td className="p-4 font-black">{coupon.code}</td>
                  <td className="p-4 font-bold">{coupon.discount_value}{coupon.discount_type === 'percent' ? '%' : '₪'}</td>
                  <td className="p-4">
                    {coupon.is_welcome_gift ? (
                      <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
                        מתנת הצטרפות ({coupon.welcome_days_valid || 7} ימים) 🎁
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">רגיל</span>
                    )}
                  </td>
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
