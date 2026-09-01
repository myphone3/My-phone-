'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

function StoreContent() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes, brandRes, bannerRes] = await Promise.all([
      supabase.from('products').select('*').or('is_published.is.null,is_published.eq.true').order('created_at', { ascending: false }),
      supabase.from('categories').select('*'),
      supabase.from('brands').select('*'),
      supabase.from('banners').select('*').eq('is_active', true),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bannerRes.data && bannerRes.data.length > 0) {
      setBanners(bannerRes.data);
    } else {
      setBanners([
        {
          id: '1',
          title: '🔥 מבצעי ענק על מכשירים כשרים וסלולר',
          subtitle: 'הנחות מיוחדות לשבוע הקרוב בלבד | משלוח מהיר עד הבית',
          image_url: '',
          link_product_id: ''
        },
        {
          id: '2',
          title: '🎧 מגוון נגנים ואביזרים איכותיים',
          subtitle: 'הציוד הטוב ביותר במחירים שלא תמצאו בשום מקום אחר',
          image_url: '',
          link_product_id: ''
        }
      ]);
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

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(query);
    const brandMatch = p.brand?.toLowerCase().includes(query);
    const categoryMatch = p.category?.toLowerCase().includes(query);
    const descMatch = p.description?.toLowerCase().includes(query);
    return nameMatch || brandMatch || categoryMatch || descMatch;
  });

  const scrollingBrands = [...brands, ...brands, ...brands];

  return (
    <div className="space-y-0 pb-16" dir="rtl">
      
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* מותגים נעים */}
      {brands.length > 0 && (
        <div className="w-full overflow-x-auto bg-orange-50/40 py-3 border-b border-orange-100 scrollbar-none">
          <div className="animate-marquee flex items-center gap-12 px-4 cursor-grab">
            {scrollingBrands.map((brand, idx) => (
              brand.image_url && (
                <Link 
                  key={`${brand.id}-${idx}`} 
                  href={`/brand/${encodeURIComponent(brand.name)}`}
                  className="w-24 h-12 flex items-center justify-center flex-shrink-0 opacity-85 hover:opacity-100 hover:scale-110 transition cursor-pointer"
                >
                  <img src={brand.image_url} alt={brand.name} className="max-h-full max-w-full object-contain" />
                </Link>
              )
            ))}
          </div>
        </div>
      )}

      {/* באנרים */}
      {banners.length > 0 && (
        <div className="relative w-full bg-gradient-to-r from-gray-950 via-orange-950 to-black overflow-hidden shadow-xl text-white py-14 px-6 sm:px-16 transition-all duration-500">
          <div className="max-w-7xl mx-auto space-y-4 relative z-10">
            <span className="bg-orange-600/35 border border-orange-500/40 text-orange-300 px-3.5 py-1 rounded-full text-xs font-bold tracking-wide backdrop-blur-md">
              NEW PHONE מבצעים חמים ⚡
            </span>
            <h1 className="text-2xl sm:text-4xl font-black leading-tight">
              {banners[currentBanner]?.title}
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm font-medium">
              {banners[currentBanner]?.subtitle}
            </p>
            {banners[currentBanner]?.link_product_id && (
              <Link 
                href={`/product/${banners[currentBanner].link_product_id}`}
                className="inline-block bg-orange-600 text-white hover:bg-orange-700 px-6 py-3 rounded-2xl text-xs font-bold transition shadow-lg cursor-pointer"
              >
                לרכישת המוצר המשתתף במבצע ➔
              </Link>
            )}
          </div>

          <div className="absolute bottom-4 left-6 flex gap-2 z-20">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentBanner(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${currentBanner === idx ? 'w-8 bg-orange-500' : 'w-2 bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 space-y-10 pt-8">

        {/* שורת חיפוש עם תפריט הצעות נפתח (Autocomplete Dropdown) */}
        <div className="relative max-w-2xl mx-auto z-30">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
            🔍
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder="חפש מכשיר, נגן, מותג או קטגוריה..."
            className="w-full bg-white border-2 border-orange-500/20 focus:border-orange-600 rounded-2xl py-3.5 pr-11 pl-4 text-xs sm:text-sm font-medium shadow-sm outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-0 pl-4 flex items-center text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              ✕ ניקוי
            </button>
          )}

          {/* תפריט השלמה אוטומטית נפתח */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-y-auto z-50 p-2 space-y-1">
              {filteredProducts.length === 0 ? (
                <div className="p-3 text-xs text-gray-500 text-center font-medium">לא נמצאו תוצאות תואמות</div>
              ) : (
                filteredProducts.map((prod) => {
                  const img = prod.image_url || prod.images?.[0] || '';
                  return (
                    <Link
                      key={prod.id}
                      href={`/product/${prod.id}`}
                      className="flex items-center gap-3 p-2.5 hover:bg-orange-50/60 rounded-xl transition group cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border">
                        {img ? (
                          <img src={img} alt={prod.name} className="w-full h-full object-contain" />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-gray-900 truncate group-hover:text-orange-600 transition">{prod.name}</h4>
                        <p className="text-[10px] text-gray-400 truncate">{prod.brand || prod.category || 'מוצר בחנות'}</p>
                      </div>
                      <span className="text-xs font-black text-orange-600 shrink-0">
                        ₪{prod.sale_price || prod.price}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* קטגוריות מובילות */}
        {categories.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">קטגוריות מובילות</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {categories.map((cat) => (
                <Link 
                  key={cat.id} 
                  href={`/category/${encodeURIComponent(cat.name)}`}
                  className="flex flex-col items-center text-center gap-2 cursor-pointer group"
                >
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white flex items-center justify-center overflow-hidden group-hover:scale-105 transition shadow-xs border border-orange-500/30">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>
                  <span className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* רשימת המוצרים הראשית למטה */}
        <section className="space-y-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              {searchQuery ? `תוצאות חיפוש עבור: "${searchQuery}"` : 'כל המוצרים בחנות'}
            </h2>
            <span className="text-xs text-gray-500 font-bold">{filteredProducts.length} מוצרים זמינים</span>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500 font-medium">טוען את חנות NEW PHONE...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
              <span className="text-4xl">🔍</span>
              <p className="text-gray-500 font-medium">לא נמצאו מוצרים תחת חיפוש זה.</p>
              <button onClick={() => setSearchQuery('')} className="inline-block bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold mt-2 cursor-pointer">
                איפוס חיפוש
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => {
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
        </section>

      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-bold text-sm text-gray-600">טוען את חנות NEW PHONE...</div>}>
      <StoreContent />
    </Suspense>
  );
}
