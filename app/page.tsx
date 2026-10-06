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
    if (p.image_url) return p.image_url;
    if (Array.isArray(p.images) && p.images.length > 0) return p.images[0];
    if (typeof p.images === 'string') {
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
        image: activeImg || '/Logo.JPG',
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
      
      {/* פתרון תקני להנפשת המותגים ללא שגיאות קומפילציה */}
      <dangerouslySetHTML-style>
        {`
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
        `}
      </dangerouslySetHTML-style>

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
          <div
