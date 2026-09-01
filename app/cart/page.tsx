'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

import Link from 'next/link';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        setCartItems(JSON.parse(saved));
      } catch (e) {
        setCartItems([]);
      }
    }
  }, []);

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cartItems];
    updated[index].quantity = (updated[index].quantity || 1) + delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    }
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  };

  const removeItem = (index: number) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  };

  const totalPrice = cartItems.reduce((sum, item) => {
    const price = item.sale_price || item.price || 0;
    return sum + price * (item.quantity || 1);
  }, 0);

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
      <h1 className="text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">עגלת קניות והשלמת הזמנה</h1>

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
          <div className="bg-white rounded-3xl border shadow-sm divide-y">
            {cartItems.map((item, index) => {
              const itemImg = item.image_url || item.images?.[0] || '';
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
                      {item.selectedVariant && <span className="text-[10px] text-gray-500 block">גרסה: {item.selectedVariant}</span>}
                      {item.selectedColor && <span className="text-[10px] text-gray-500 block">צבע: {item.selectedColor.name}</span>}
                      <p className="text-xs text-orange-600 font-bold mt-1">₪{itemPrice} ליחידה</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-xl bg-gray-50 overflow-hidden">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="px-3 py-1 text-xs font-bold hover:bg-gray-200 transition cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-black">{qty}</span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="px-3 py-1 text-xs font-bold hover:bg-gray-200 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
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

          <form onSubmit={handleCheckout} className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
            <h3 className="font-black text-sm border-r-4 border-orange-600 pr-2">פרטי משלוח למשלוח מהיר עד הבית</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">שם מלא</label>
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
                <label className="block text-xs font-bold text-gray-700 mb-1">טלפון נייד</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                  className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">כתובת מלאה למשלוח</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="עיר, רחוב, מספר דירה..."
                rows={2}
                className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
                required
              ></textarea>
            </div>

            <div className="border-t pt-4 flex justify-between items-center text-sm font-bold text-gray-700">
              <span>סכום ביניים:</span>
              <span className="text-lg font-black text-gray-900">₪{totalPrice}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>משלוח מהיר עד הבית:</span>
              <span className="font-bold text-green-600">חינם 🚚</span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-base font-black text-gray-900">סה"כ לתשלום:</span>
              <span className="text-xl font-black text-orange-600">₪{totalPrice}</span>
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
    </div>
  );
}
