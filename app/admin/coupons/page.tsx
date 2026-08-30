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

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (data) setCoupons(data);
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountValue) return alert('נא למלא את כל השדות');

    const { error } = await supabase.from('coupons').insert([
      {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        is_welcome_gift: isWelcomeGift
      }
    ]);

    if (error) {
      alert('שגיאה ביצירת קופון (אולי הקוד כבר קיים): ' + error.message);
    } else {
      alert('הקופון נוצר בהצלחה! 🎟️');
      setCode('');
      setDiscountValue('');
      setIsWelcomeGift(false);
      fetchCoupons();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק קופון זה?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    fetchCoupons();
  };

  return (
    <div className="max-w-4xl mx-auto p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-gray-900">🎟️ ניהול קופונים ומבצעים</h1>
        <Link href="/admin/products" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl text-sm font-bold text-gray-700">
          חזרה לניהול מוצרים 🔙
        </Link>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border mb-8">
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

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="welcomeGift"
              checked={isWelcomeGift} 
              onChange={(e) => setIsWelcomeGift(e.target.checked)}
              className="w-4 h-4 accent-black rounded"
            />
            <label htmlFor="welcomeGift" className="text-sm font-medium text-gray-800">
              הגדר כמתנת הצטרפות אוטומטית ללקוחות חדשים בשבוע הראשון 🎁
            </label>
          </div>

          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition">
            צור קופון חדש ✨
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 font-bold text-sm">קופונים קיימים במערכת</div>
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
                      <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">מתנת הצטרפות 🎁</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium">רגיל</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:text-red-800 text-xs font-bold">
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
