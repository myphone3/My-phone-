'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/StoreHeader';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('cart') || '[]');
      setCartItems(saved);
    } catch (e) {
      setCartItems([]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cartItems];
    newCart[index].quantity = (Number(newCart[index].quantity) || 1) + delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (!customerName || !customerPhone) {
      alert('אנא מלא שם ומספר טלפון');
      return;
    }

    try {
      const { error } = await supabase.from('orders').insert([{
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress || 'איסוף עצמי',
        items: cartItems,
        total: calculateTotal(),
        status: 'בטיפול'
      }]);

      if (error) throw error;

      alert('ההזמנה בוצעה בהצלחה ונשלחה לניהול! 🎉');
      localStorage.removeItem('cart');
      setCartItems([]);
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err: any) {
      alert('שגיאה בביצוע ההזמנה: ' + err.message);
    }
  };

  return (
    <>
      <StoreHeader />
      {cartItems.length === 0 ? (
        <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6" dir="rtl">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-3xl">🛒</div>
          <h1 className="text-2xl font-black text-gray-900">העגלה שלך ריקה</h1>
          <p className="text-gray-500 text-sm">עדיין לא הוספת מוצרים לעגלה</p>
          <div>
            <Link href="/" className="inline-block bg-black text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-gray-800 transition shadow-md">
              למעבר לקטלוג 🏠
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
          <h1 className="text-3xl font-black text-gray-900">עגלת הקניות שלך 🛒</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {cartItems.map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900">{item.name}</h3>
                    <div className="text-xs text-gray-500 space-x-2 space-x-reverse mt-1">
                      {item.selectedVersion && <span>גרסה: {item.selectedVersion}</span>}
                      {item.selectedStorage && <span>נפח: {item.selectedStorage}</span>}
                      {item.selectedColor && <span>צבע: {item.selectedColor}</span>}
                    </div>
                    <div className="text-sm font-black text-black mt-1">₪{item.price}</div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border">
                    <button onClick={() => updateQuantity(index, -1)} className="text-gray-600 font-bold px-2">-</button>
                    <span className="text-sm font-bold">{item.quantity || 1}</span>
                    <button onClick={() => updateQuantity(index, 1)} className="text-gray-600 font-bold px-2">+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 h-fit">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">סיכום הזמנה</h3>
              <div className="flex justify-between font-black text-lg">
                <span>סה״כ לתשלום:</span>
                <span>₪{calculateTotal()}</span>
              </div>

              <form onSubmit={handleCheckout} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">שם מלא *</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ישראל ישראלי" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">טלפון נייד *</label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="050-0000000" className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">כתובת למשלוח / איסוף עצמי</label>
                  <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="עיר, רחוב, מספר..." className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-black" />
                </div>
                <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition shadow-lg text-base mt-4">
                  אישור הזמנה ושלח 🚀
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
