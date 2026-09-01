'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) setCartItems(JSON.parse(saved));
  }, []);

  const totalPrice = cartItems.reduce((sum, item) => sum + (item.sale_price || item.price || 0) * (item.quantity || 1), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !address) {
      alert('נא למלא פרטי לקוח מלאים (שם, טלפון וכתובת)');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('orders').insert([
      {
        customer_name: name,
        phone,
        address,
        items: cartItems,
        total_price: totalPrice,
        status: 'חדש'
      }
    ]);

    setSubmitting(false);
    if (error) {
      alert('שגיאה בשליחת ההזמנה: ' + error.message);
    } else {
      alert('ההזמנה בוצעה בהצלחה! צוות NEW PHONE יצור איתך קשר בהקדם.');
      localStorage.removeItem('cart');
      setCartItems([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">השלמת הזמנה ועגלת קניות</h1>

      {cartItems.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">העגלה שלך ריקה</h2>
          <Link href="/" className="inline-block bg-orange-600 text-white px-6 py-3 rounded-2xl text-xs font-bold">
            🏠 למעבר לקטלוג החנות
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border shadow-sm divide-y">
            {cartItems.map((item, idx) => (
              <div key={idx} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <img src={item.image_url} alt="" className="w-12 h-12 object-contain bg-gray-50 rounded-lg border p-1" />
                  <div>
                    <h4 className="font-bold text-xs">{item.name}</h4>
                    {item.selectedVariant && <span className="text-[10px] text-gray-500 block">גרסה: {item.selectedVariant}</span>}
                    {item.selectedColor && <span className="text-[10px] text-gray-500 block">צבע: {item.selectedColor.name}</span>}
                  </div>
                </div>
                <span className="text-xs font-black text-orange-600">₪{item.sale_price || item.price}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleCheckout} className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
            <h3 className="font-black text-sm border-r-4 border-orange-600 pr-2">פרטי משלוח ותשלום</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא" className="bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="מספר טלפון" className="bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required />
            </div>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="כתובת מלאה למשלוח (עיר, רחוב, מספר בית)" rows={2} className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600" required></textarea>

            <div className="border-t pt-4 flex justify-between items-center text-sm font-black">
              <span>סה״כ לתשלום:</span>
              <span className="text-orange-600 text-lg">₪{totalPrice}</span>
            </div>

            <button type="submit" disabled={submitting} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition cursor-pointer shadow-md">
              {submitting ? 'שולח הזמנה...' : 'אישור הזמנה ותשלום ➔'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
