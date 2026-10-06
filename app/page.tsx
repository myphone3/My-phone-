'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

function StoreContent() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean } | null>(null);
  
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!settings?.announcement_end_time) return;

    const targetTime = new Date(settings.announcement_end_time).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [settings]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, brandRes, bannerRes, settingsRes] = await Promise.all([
        supabase.from('products').select('*').or('is_published.is.null,is_published.eq.true').order('created_at', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('brands').select('*'),
        supabase.from('banners').select('*').eq('is_active', true),
        supabase.from('settings').select('*').single(),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);
      if (brandRes.data) setBrands(brandRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);

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
          }
        ]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleColorClick = (productId: string, colorImg: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (colorImg) {
      setSelectedColors((prev) => ({ ...prev, [productId]: colorImg }));
    }
  };

  const getProductImage = (p: any, colorImg?: string) => {
    if (colorImg && typeof colorImg === 'string' && colorImg.trim().length > 0) return colorImg;
    if (p?.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p?.images) && p.images.length > 0) return p.images[0];
    if (typeof p?.images === 'string') {
      try {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        if (typeof parsed === 'string') return parsed;
      } catch {
        return p.images;
      }
    }
    return '';
  };

  const getKosherValue = (p: any) => {
    return p?.kosher_image || p?.kosher || p?.kosher_logo || p?.kosher_badge || p?.kosher_img || p?.kosherImage || p?.kosherLogo || '';
  };

  const handleQuickAddToCart = (product: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const colors = product.product_colors || product.colors || [];
      const versions = product.versions || product.product_versions || [];
      
      const firstColor = colors[0] || {};
      const firstVersion = versions[0] || {};
      
      const finalPrice = product.sale_price || product.price || 0;
      const versionExtra = typeof firstVersion === 'object' ? (firstVersion?.price_add || firstVersion?.price || 0) : 0;
      const unitPrice = Number(finalPrice) + Number(versionExtra);

      const colorName = typeof firstColor === 'object' ? firstColor?.name : firstColor || '';
      const versionName = typeof firstVersion === 'object' ? firstVersion?.name : firstVersion || '';
      
      const activeImg = getProductImage(product, selectedColors[product.id] || (typeof firstColor === 'object' ? firstColor?.image : ''));

      const cartItem = {
        id: `${product.id}-${colorName}-${versionName}`,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        image: activeImg || product.image_url || '',
        image_url: activeImg || product.image_url || '',
        color: colorName,
        version: versionName,
        quantity: 1
      };

      const existingIndex = cart.findIndex((item: any) => item.id === cartItem.id);
      if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
      } else {
        cart.push(cartItem);
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      alert('המוצר נוסף בהצלחה לעגלה! 🛒');
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  const scrollingBrands = [...brands, ...brands, ...brands, ...brands];

  return (
    <div className="space-y-0 pb-16" dir="rtl">
      
      <style>{`
        @keyframes marqueeRight {
          0% { transform: translateX(0); }
          100% { transform: translateX(50%); }
        }
        .animate-marquee-right {
          display: flex;
          width: max-content;
          animation: marqueeRight 25s linear infinite;
        }
        .animate-marquee-right:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* פס מבצעים עליון סטטי עם טיימר */}
      {settings?.announcement_text && (
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between gap-4 shadow-sm z-50">
          {timeLeft && !timeLeft.isExpired && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-black/30 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider">
                {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')} ⏱️
              </span>
            </div>
          )}
          <div className="flex-1 text-right text-xs sm:text-sm truncate">
            {settings.announcement_text}
          </div>
        </div>
      )}

      {/* שורת מותגים פעילה */}
      {brands.length > 0 && (
        <div className="w-full overflow-hidden bg-white py-3 border-b border-gray-100">
          <div className="animate-marquee-right flex items-center gap-8 px-4">
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

      {/* באנר ראשי */}
      {banners.length > 0 && (
        <div className="relative w-full overflow-hidden bg-black">
          {banners[currentBanner]?.desktop_image_url || banners[currentBanner]?.mobile_image_url || banners[currentBanner]?.image_url ? (
            <div className="relative w-full">
              {banners[currentBanner]?.desktop_image_url && (
                <img 
                  src={banners[currentBanner].desktop_image_url} 
                  alt={banners[currentBanner]?.title || ''} 
                  className={`w-full h-auto object-cover max-h-[460px] min-h-[260px] ${banners[currentBanner]?.mobile_image_url ? 'hidden sm:block' : 'block'}`}
                />
              )}
              {banners[currentBanner]?.mobile_image_url && (
                <img 
                  src={banners[currentBanner].mobile_image_url} 
                  alt={banners[currentBanner]?.title || ''} 
                  className="w-full h-auto object-cover max-h-[380px] min-h-[220px] block sm:hidden"
                />
              )}
              {!banners[currentBanner]?.desktop_image_url && !banners[currentBanner]?.mobile_image_url && banners[currentBanner]?.image_url && (
                <img 
                  src={banners[currentBanner].image_url} 
                  alt={banners[currentBanner]?.title || ''} 
                  className="w-full h-auto object-cover max-h-[460px] min-h-[260px]"
                />
              )}

              {banners[currentBanner]?.link_product_id && (
                <Link 
                  href={`/product/${banners[currentBanner].link_product_id}`}
                  className="absolute inset-0 z-10 cursor-pointer"
                />
              )}
            </div>
          ) : (
            <div className="relative w-full bg-gradient-to-r from-gray-950 via-orange-950 to-black text-white py-14 px-4 sm:px-16">
              <div className="max-w-5xl mx-auto space-y-3 relative z-10 text-right sm:text-center flex flex-col items-start sm:items-center">
                <span className="inline-block bg-orange-600/35 border border-orange-500/40 text-orange-300 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold tracking-wide backdrop-blur-md">
                  NEW PHONE מבצעים חמים ⚡
                </span>
                <h1 className="w-full text-lg sm:text-3xl md:text-4xl font-black leading-snug sm:leading-tight break-words">
                  {banners[currentBanner]?.title}
                </h1>
                <p className="w-full text-gray-300 text-xs sm:text-sm font-medium leading-relaxed">
                  {banners[currentBanner]?.subtitle}
                </p>
              </div>
            </div>
          )}

          {banners.length > 1 && (
            <div className="absolute bottom-3 left-4 sm:left-1/2 sm:-translate-x-1/2 flex gap-1.5 z-20">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBanner(idx)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${currentBanner === idx ? 'w-6 bg-orange-500' : 'w-2 bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 space-y-10 pt-8">

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

        {/* כל המוצרים */}
        <section className="space-y-6 pt-4 border-t">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
              כל המוצרים
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-20 text-gray-500 font-medium">טוען את חנות NEW PHONE...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
              <span className="text-4xl">📦</span>
              <p className="text-gray-500 font-medium">אין מוצרים זמינים כרגע בחנות.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => {
                const colors = product.product_colors || product.colors || [];
                const primaryImg = getProductImage(product);
                const secondaryImg = (Array.isArray(product.images) && product.images[1]) || primaryImg;
                const activeImage = selectedColors[product.id] || primaryImg;
                const hasHoverImage = secondaryImg && secondaryImg !== primaryImg && !selectedColors[product.id];

                const currentBrandObj = brands.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
                const brandLogo = currentBrandObj?.image_url;
                const kosherVal = getKosherValue(product);
                const isKosherUrl = typeof kosherVal === 'string' && (kosherVal.startsWith('http') || kosherVal.startsWith('/'));

                return (
                  <div 
                    key={product.id} 
                    className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between p-4 hover:shadow-xl transition-all duration-300"
                  >
                    <Link href={`/product/${product.id}`} className="block space-y-3">
                      <div className="h-40 sm:h-52 w-full bg-gray-50 rounded-2xl flex items-center justify-center relative overflow-hidden group">
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

                        {/* תגיות לוגו מותג ולוגו כשרות חכם (תמונה או תגית טקסט, ללא סימן שאלה) */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                          {brandLogo && (
                            <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow border border-gray-100 flex items-center justify-center">
                              <img src={brandLogo} alt="" className="w-full h-full object-contain" />
                            </div>
                          )}
                          {kosherVal && (
                            isKosherUrl ? (
                              <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow border border-gray-100 flex items-center justify-center">
                                <img src={kosherVal} alt="" className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-xs flex items-center justify-center text-center max-w-[55px] truncate">
                                {kosherVal}
                              </div>
                            )
                          )}
                        </div>

                        {product.sale_price && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                            מבצע ⚡
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900 text-xs sm:text-sm leading-snug">{product.name}</h3>
                      </div>
                    </Link>

                    <div className="pt-3 mt-3 border-t flex flex-col gap-3">
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

                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between">
                          {product.sale_price ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm sm:text-base font-black text-red-600">₪{product.sale_price}</span>
                              <span className="text-xs text-gray-400 line-through">₪{product.price}</span>
                            </div>
                          ) : (
                            <span className="text-sm sm:text-base font-black text-gray-900">₪{product.price}</span>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleQuickAddToCart(product, e)}
                          className="w-full bg-orange-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-orange-700 transition cursor-pointer shadow-sm text-center"
                        >
                          הוספה לעגלה
                        </button>
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
