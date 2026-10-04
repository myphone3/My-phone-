'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // שליפה נקייה וישירה מכל הטבלה בלי תנאים מורכבים
        const { data, error } = await supabase
          .from('products')
          .select('*');

        if (error) {
          console.error('Supabase error:', error.message);
          setProducts([]);
        } else {
          setProducts(data || []);
        }
      } catch (err) {
        console.error('Fetch exception:', err);
        setProducts([]);
      } finally {
        setLoading(false); // משחרר את מסך הטעינה מיידית
      }
    };

    fetchProducts();
  }, []);

  const handleColorClick = (productId: string, colorImg: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (colorImg) {
      setSelectedColors((prev) => ({ ...prev, [productId]: colorImg }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-black text-gray-900">כל המוצרים בחנות</h1>
        <span className="text-xs font-bold bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full">
          {products.length} מוצרים זמינים
        </span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-bold text-sm">
          טוען את חנות NEW PHONE...
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <span className="text-4xl">📦</span>
          <p className="text-gray-600 font-bold text-sm">אין מוצרים זמינים כרגע במסד הנתונים.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product) => {
            const colors = product.product_colors || [];
            const primaryImg = product.image_url || product.images?.[0] || '';
            const secondaryImg = product.images?.[1] || primaryImg;
            const activeImage = selectedColors[product.id] || primaryImg;
            const hasHoverImage = secondaryImg && secondaryImg !== primaryImg && !selectedColors[product.id];

            return (
              <div 
                key={product.id} 
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all duration-300 p-4"
              >
                <Link href={`/product/${product.id}`} className="block">
                  <div className="h-40 sm:h-52 w-full bg-gray-50 overflow-hidden relative rounded-2xl mb-3 flex items-center justify-center">
                    <img 
                      src={activeImage} 
                      alt={product.name} 
                      className={`w-full h-full object-contain transition duration-300 group-hover:scale-105 ${hasHoverImage ? 'group-hover:opacity-0' : ''}`} 
                    />
                    {hasHoverImage && (
                      <img 
                        src={secondaryImg} 
                        alt={product.name} 
                        className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition duration-300 group-hover:scale-105" 
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-gray-900 text-xs sm:text-sm line-clamp-1">{product.name}</h3>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{product.short_description || product.description}</p>
                  </div>
                </Link>

                <div className="pt-3 mt-3 border-t flex flex-col gap-2">
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
                            onClick={(e) => handleColorClick(product.id, colImg, e)}
                            className="w-4 h-4 rounded-full border border-gray-300 shrink-0 shadow-xs cursor-pointer hover:scale-110 transition"
                            style={{ backgroundColor: colHex }}
                          ></button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm sm:text-base font-black text-gray-900">₪{product.price}</span>
                    </div>
                    <Link
                      href={`/product/${product.id}`}
                      className="bg-orange-600 text-white px-3.5 py-2 rounded-xl text-[11px] font-bold hover:bg-orange-700 transition whitespace-nowrap cursor-pointer shadow-sm"
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
