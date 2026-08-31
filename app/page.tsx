'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // מצבי בחירה לכל מוצר (מפתחות לפי ID של המוצר)
  const [selectedVersions, setSelectedVersions] = useState<{ [key: string]: string }>({});
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});
  const [selectedStorages, setSelectedStorages] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    // שליפת מוצרים שאינם בטיוטה בלבד (או ששדה הפרסום שלהם ריק/true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .or('is_published.is.null,is_published.eq.true')
      .order('created_at', { ascending: false });

    if (data) setProducts(data);
    setLoading(false);
  };

  const addToCart = (product: any) => {
    // בדיקת גרסאות מרובות אם קיימות
    const versions = product.product_versions || [];
    if (versions.length > 0 && !selectedVersions[product.id]) {
      alert('נא לבחור גרסה לפני הוספה לסל.');
      return;
    }

    // בדיקת צבעים אם קיימים
    const colors = product.product_colors || [];
    if (colors.length > 0 && !selectedColors[product.id]) {
      alert('נא לבחור צבע לפני הוספה לסל.');
      return;
    }

    // בדיקת נפח אחסון אם קיים
    if (product.storage && !selectedStorages[product.id]) {
      alert('נא לבחור נפח אחסון לפני הוספה לסל.');
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      // יצירת פריט ייחודי לסל כולל הבחירות של הלקוח
      const cartItem = {
        ...product,
        selectedVersion: selectedVersions[product.id] || product.version || '',
        selectedColor: selectedColors[product.id] || '',
        selectedStorage: selectedStorages[product.id] || product.storage || '',
        cartId: `${product.id}-${selectedVersions[product.id] || ''}-${selectedColors[product.id] || ''}-${selectedStorages[product.id] || ''}`
      };

      const existingIndex = cart.findIndex((item: any) => item.cartId === cartItem.cartId);
      if (existingIndex > -1) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
      } else {
        cart.push({ ...cartItem, quantity: 1 });
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
          {products.map((product) => {
            const versions = product.product_versions || [];
            const colors = product.product_colors || [];

            return (
              <div key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition p-4">
                <div>
                  {product.image_url ? (
                    <div className="h-48 w-full bg-gray-50 overflow-hidden relative rounded-2xl mb-3">
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-bold rounded-2xl mb-3">
                      אין תמונה
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <h3 className="font-black text-gray-900 text-base line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{product.short_description || product.description}</p>

                    {/* בחירת גרסה (אם קיימת) */}
                    {versions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        כשרות/גרסה:
                        <div className="flex flex-wrap gap-1.5">
                          {versions.map((ver: string) => (
                            <button
                              key={ver}
                              type="button"
                              onClick={() => setSelectedVersions({ ...selectedVersions, [product.id]: ver })}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                                selectedVersions[product.id] === ver
                                  ? 'bg-black text-white border-black'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-black'
                              }`}
                            >
                              {ver}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* בחירת צבע (אם קיים) */}
                    {colors.length > 0 && (
                      <div className="space-y-1 pt-1">
                        צבע:
                        <div className="flex flex-wrap gap-1.5">
                          {colors.map((col: any) => {
                            const colName = typeof col === 'string' ? col : col.name;
                            const colHex = typeof col === 'object' ? col.hex : '';
                            const isSelected = selectedColors[product.id] === colName;

                            return (
                              <button
                                key={colName}
                                type="button"
                                onClick={() => setSelectedColors({ ...selectedColors, [product.id]: colName })}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition border flex items-center gap-1.5 ${
                                  isSelected ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                {colHex && <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: colHex }}></span>}
                                {colName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* נפח אחסון (אם קיים) */}
                    {product.storage && (
                      <div className="text-xs text-gray-600 pt-1">
                        <span className="font-bold">נפח אחסון:</span> {product.storage}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="text-lg font-black text-gray-900">₪{product.price}</span>
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
                  >
                    הוסף לעגלה 🛒
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
