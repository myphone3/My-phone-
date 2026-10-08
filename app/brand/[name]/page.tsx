'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function BrandPage() {
  const params = useParams();
  const brandName = decodeURIComponent((params?.name as string) || '');

  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (brandName) {
      fetchBrandData();
    }
  }, [brandName]);

  const fetchBrandData = async () => {
    try {
      setLoading(true);

      let fetchedKosher: any[] = [];
      const [k1, k2, k3] = await Promise.all([
        supabase.from('kosher').select('*'),
        supabase.from('kosher_certifications').select('*'),
        supabase.from('kosher_options').select('*')
      ]);

      if (k3.data && k3.data.length > 0) fetchedKosher = k3.data;
      else if (k1.data && k1.data.length > 0) fetchedKosher = k1.data;
      else if (k2.data && k2.data.length > 0) fetchedKosher = k2.data;

      const [prodRes, brandRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .ilike('brand', brandName)
          .or('is_published.is.null,is_published.eq.true')
          .order('created_at', { ascending: false }),
        supabase.from('brands').select('*'),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (brandRes.data) setBrands(brandRes.data);
      setKosherList(fetchedKosher);
    } catch (err) {
      console.error('Error fetching brand products:', err);
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

  const getKosherLogo = (p: any) => {
    const val = p?.kosher || p?.kosher_certification || p?.kosher_name || p?.kosher_image || p?.kosher_logo || '';
    if (!val) return '';
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'))) return val;
    const found = kosherList.find(k => k.name?.trim().toLowerCase() === String(val).trim().toLowerCase());
    return found?.image_url || found?.image || found?.logo || '';
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-16" dir="rtl">
      {/* כותרת המותג */}
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">
          מותג: {brandName}
        </h1>
        <span className="text-xs sm:text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {products.length} מוצרים זמינים
        </span>
      </div>

      {loading ? (
        <div className="text-center py-20 font-bold text-sm text-gray-600">טוען מוצרים...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <span className="text-4xl">📦</span>
          <p className="text-gray-500 font-medium">אין מוצרים זמינים תחת מותג זה כרגע.</p>
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
            const kosherLogo = getKosherLogo(product);

            return (
              <div 
                key={product.id} 
                className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between p-4 hover:shadow-xl transition-all duration-300"
              >
                <Link href={`/product/${product.id}`} className="block space-y-3">
                  <div className="h-40 sm:h-52 w-full bg-gray-50 rounded-2xl flex items-center justify-center relative overflow-hidden group">
                    {/* תגית מבצע */}
                    {product.sale_price && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-xs z-10">
                        מבצע 🔥
                      </span>
                    )}

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

                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                      {brandLogo && (
                        <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow border border-gray-100 flex items-center justify-center">
                          <img src={brandLogo} alt="" className="w-full h-full object-contain" />
                        </div>
                      )}
                      {kosherLogo && (
                        <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow border border-gray-100 flex items-center justify-center">
                          <img src={kosherLogo} alt="Kosher" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2 className="font-bold text-gray-900 text-xs sm:text-sm text-right group-hover:text-orange-600 transition leading-snug break-words" dir="auto">
                      {product.name}
                    </h2>
                    <p className="text-gray-500 text-xs text-right">
                      {product.brand || ''}
                    </p>
                  </div>
                </Link>

                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  {colors.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5">
                      {colors.map((c: any, idx: number) => {
                        const colorName = typeof c === 'object' ? c.name : c;
                        const colorImg = typeof c === 'object' ? (c.image_url || c.image) : '';
                        const colorHex = typeof c === 'object' ? (c.hex || c.code) : '';
                        const isSelected = selectedColors[product.id] === colorImg || (!selectedColors[product.id] && idx === 0);

                        return (
                          <button
                            key={idx}
                            onClick={(e) => handleColorClick(product.id, colorImg, e)}
                            className={`w-7 h-7 rounded-lg transition relative flex items-center justify-center shrink-0 cursor-pointer bg-white ${
                              isSelected ? 'border-2 border-orange-600 shadow-sm' : 'border border-gray-200'
                            }`}
                            style={{ backgroundColor: colorImg ? 'transparent' : (colorHex || '#ccc') }}
                            title={colorName}
                          >
                            {colorImg && (
                              <img src={colorImg} alt={colorName} className="w-full h-full object-cover rounded-md" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="text-xs text-gray-400 block">מחיר</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-black ${product.sale_price ? 'text-orange-600' : 'text-gray-900'}`}>
                          ₪{product.sale_price || product.price || 0}
                        </span>
                        {product.sale_price && (
                          <span className="text-xs text-gray-400 line-through">
                            ₪{product.price}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleQuickAddToCart(product, e)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl text-xs font-bold transition shadow-sm text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>הוספה לעגלה</span>
                      <span>🛒</span>
                    </button>
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
