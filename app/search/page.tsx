'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchProducts();
  }, [query]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').or('is_published.is.null,is_published.eq.true');
    if (data) {
      const filtered = data.filter((p) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
        );
      });
      setProducts(filtered);
    }
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
          תוצאות חיפוש עבור: &quot;{query}&quot;
        </h1>
        <span className="text-xs text-gray-500 font-bold block">{products.length} מוצרים נמצאו</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">מחפש מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <span className="text-4xl">🔍</span>
          <p className="text-gray-500 font-medium">לא נמצאו מוצרים התואמים את החיפוש שלך.</p>
          <Link href="/" className="inline-block bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold mt-2 cursor-pointer">
            חזרה לחנות הבית
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-bold text-sm text-gray-600">טוען תוצאות חיפוש...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
