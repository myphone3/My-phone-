'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
    setLoading(false);
  };

  const addToCart = (product: any) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const existingIndex = cart.findIndex((item: any) => item.id === product.id);
      if (existingIndex > -1) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
      } else {
        cart.push({ ...product, quantity: 1 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      alert('המוצר נוסף לעגלה בהצלחה! 🛒');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
      {/* באנר ברוכים הבאים */}
      <div className="bg-gray-100 rounded-3xl p-8 mb-10 text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900">🛒 ברוכים הבאים לחנות</h1>
        <p className="text-gray-600 text-sm sm:text-base font-medium">כל המוצרים האיכותיים ביותר במקום אחד</p>
      </div>

      {/* כותרת רשימת מוצרים */}
      <h2 className="text-xl font-black text-gray-900 mb-6">המוצרים שלנו</h2>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 p-8 space-y-3 shadow-sm">
          <span className="text-4xl">📦</span>
          <p className="text-gray-500 font-medium">אין מוצרים זמינים בחנות כרגע.</p>
        </div>
      ) : (<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">

          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
              <div>
                {product.image_url ? (
                  <div className="h-48 w-full bg-gray-50 overflow-hidden relative">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold">
                    אין תמונה
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <h3 className="font-black text-gray-900 text-base line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center justify-between mt-4">
                <span className="text-lg font-black text-gray-900">₪{product.price}</span>
                <button
                  onClick={() => addToCart(product)}
                  className="bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
                >
                  הוסף לעגלה 🛒
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
