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
    if (colorImg) return colorImg;
    if (p?.image_url) return p.image_url;
    if (Array.isArray(p?.images) && p.images.length > 0) return p.images[0];
    if (typeof p?.images === 'string') {
      try {
        const parsed = JSON.parse(p.images);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      } catch {
        return p.images;
      }
    }
    return '';
  };

  const getKosherImg = (p: any) => {
    const img = p?.kosher_image || p?.kosher || p?.kosher_logo || p?.kosher_badge || p?.kosher_img || p?.kosherImage || p?.kosherLogo || '';
    if (typeof img === 'string' && img.trim().length > 0) return img;
    return '';
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
      
      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />

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
          <
