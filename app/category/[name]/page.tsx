'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CategoryPage() {
  const params = useParams();
  const categoryName = decodeURIComponent(params.name as string);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, [categoryName]);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('category', categoryName).or('is_published.is.null,is_published.eq.true'),
      supabase.from('categories').select('*'),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const handleColorClick = (productId: string, colorImg: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (colorImg) {
      setSelectedColors((prev) => ({ ...prev, [productId]: colorImg }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" dir="rtl">
      
      {/* פס תיקיות / פירורי לחם דק כמו במחשב */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl w-fit">
        <Link href="/" className="hover:text-black transition">דף הבית</Link>
        <span>/</span>
        <span>קטגוריות</span>
        <span>/</span>
        <span className="text-black">{categoryName}</span>
      </div>

      {/* סרגל ניווט מהיר בין קטגוריות (כמו תיקיות בסיור במחשב) */}
      {categories.length > 0 && (
        <div className="overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-2 w-max">
            {categories.map((cat) => {
              const isActive = cat.name === categoryName;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${encodeURIComponent(cat.name)}`}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                    isActive 
                      ? 'bg-black text-white border-black shadow-md' 
                      : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {cat.image_url && <img src={cat.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                  <span>{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* כותרת עמוד */}
      <div className="border-b pb-4 flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">קטגוריה: {categoryName}</h1>
        <span className="text-xs text-gray-500 font-bold">{products.length} מוצרים זמינים</span>
      </div>

      {/* רשימת מוצרים */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <span className="text-4xl">📦</span>
          <p className="text-gray-500 font-medium">אין מוצרים זמינים בקטגוריה זו כרגע.</p>
          <Link href="/" className="inline-block bg-black text-white px-4 py-2 rounded-xl text-xs font-bold mt-2">
            חזרה לדף הבית
          </Link>
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
                    {product.sale_price && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                        מבצע ⚡
                      </span>
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
                      {product.sale_price ? (
                        <>
                          <span className="text-sm sm:text-base font-black text-red-600">₪{product.sale_price}</span>
                          <span className="text-[10px] text-gray-400 line-through">₪{product.price}</span>
                        </>
                      ) : (
                        <span className="text-sm sm:text-base font-black text-gray-900">₪{product.price}</span>
                      )}
                    </div>
                    <Link
                      href={`/product/${product.id}`}
                      className="bg-black text-white px-3.5 py-2 rounded-xl text-[11px] font-bold hover:bg-gray-800 transition whitespace-nowrap cursor-pointer"
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
