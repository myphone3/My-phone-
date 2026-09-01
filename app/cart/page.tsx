'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<any[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">עגלת קניות</h1>

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

          <div className="bg-white rounded-3xl border p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-sm font-bold text-gray-700">
              <span>סכום ביניים:</span>
              <span className="text-lg font-black text-gray-900">₪{totalPrice}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 border-t pt-3">
              <span>משלוח מהיר עד הבית:</span>
              <span className="font-bold text-green-600">חינם 🚚</span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-base font-black text-gray-900">סה"כ לתשלום:</span>
              <span className="text-xl font-black text-orange-600">₪{totalPrice}</span>
            </div>
            <button
              onClick={() => alert('ההזמנה נקלטה בהצלחה! צוות החנות יצור איתך קשר בהקדם.')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black transition shadow-md cursor-pointer"
            >
              לתשלום והשלמת הזמנה ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
