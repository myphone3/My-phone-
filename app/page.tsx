'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productImages, setProductImages] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .or('is_published.is.null,is_published.eq.true')
      .order('created_at', { ascending: false });

    if (data) {
      setProducts(data);
      // אתחול תמונה ראשית לכל מוצר
      const initialImages: { [key: string]: string } = {};
      data.forEach((p) => {
        initialImages[p.id] = p.image_url || p.images?.[0] || '';
      });
      setProductImages(initialImages);
    }
    setLoading(false);
  };

  const handleImageChange = (productId: string, url: string) => {
    if (!url) return;
    setProductImages((prev) => ({ ...prev, [productId]: url }));
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8" dir="rtl">
      {/* באנר ברוכים הבאים */}
      <div className="bg-gray-100 rounded-3xl p-6 sm:p-8 mb-8 text-center space-y-2">
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900">🛒 ברוכים הבאים לחנות</h1>
        <p className="text-gray-600 text-xs sm:text-base font-medium">כל המוצרים האיכותיים ביותר במקום אחד</p>
      </div>

      <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-4 sm:mb-6">המוצרים שלנו</h2>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 p-8 space-y-3 shadow-sm">
          <span className="text-4xl">📦</span>
          <p className="text-gray-500 font-medium">אין מוצרים זמינים בחנות כרגע.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {products.map((product) => {
            const colors = product.product_colors || [];
            const primaryImg = product.image_url || product.images?.[0] || '';
            const secondaryImg = product.images?.[1] || primaryImg;
            const currentImg = productImages[product.id] || primaryImg;

            return (
              <div 
                key={product.id} 
                className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition p-3 sm:p-4"
                onMouseEnter={() => handleImageChange(product.id, secondaryImg)}
                onMouseLeave={() => handleImageChange(product.id, primaryImg)}
              >
                <Link href={`/product/${product.id}`} className="block">
                  {currentImg ? (
                    <div className="h-36 sm:h-48 w-full bg-gray-50 overflow-hidden relative rounded-xl sm:rounded-2xl mb-3 flex items-center justify-center">
                      <img src={currentImg} alt={product.name} className="w-full h-full object-contain hover:scale-105 transition" />
                    </div>
                  ) : (
                    <div className="h-36 sm:h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold rounded-xl sm:rounded-2xl mb-3">
                      אין תמונה
                    </div>
                  )}
                  <div className="space-y-1">
                    <h3 className="font-black text-gray-900 text-xs sm:text-base line-clamp-1">{product.name}</h3>
                    <p className="text-[11px] sm:text-xs text-gray-500 line-clamp-2">{product.short_description || product.description}</p>
                  </div>
                </Link>

                <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t flex flex-col gap-2">
                  {colors.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {colors.map((col: any, idx: number) => {
                        const colHex = typeof col === 'object' ? col.hex : '#000000';
                        const colName = typeof col === 'object' ? col.name : col;
                        const colImg = typeof col === 'object' ? col.image : '';

                        return (
                          <button
                            key={idx}
                            title={colName}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (colImg) handleImageChange(product.id, colImg);
                            }}
                            className="w-4 h-4 rounded-full border border-gray-300 shrink-0 shadow-2xs cursor-pointer hover:scale-110 transition"
                            style={{ backgroundColor: colHex }}
                          ></button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm sm:text-lg font-black text-gray-900">₪{product.price}</span>
                    <Link
                      href={`/product/${product.id}`}
                      className="bg-black text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold hover:bg-gray-800 transition whitespace-nowrap"
                    >
                      לצפייה
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
