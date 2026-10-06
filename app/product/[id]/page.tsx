'use client';

import React, { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // בחירת מוצרים נלווים שתמיד באים יחד
  const [selectedBundles, setSelectedBundles] = useState<{ name: string; price: number }[]>([]);

  // חלון קופץ למוצר בהנחה
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [upsellProductData, setUpsellProductData] = useState<any>(null);

  useEffect(() => {
    if (productId) fetchProductAndData();
  }, [productId]);

  const fetchProductAndData = async () => {
    try {
      setLoading(true);
      const [prodRes, brandRes, kosherRes, allProdRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('brands').select('*'),
        supabase.from('kosher_options').select('*'),
        supabase.from('products').select('*').neq('id', productId)
      ]);

      if (prodRes.data) {
        const p = prodRes.data;
        setProduct(p);
        setSelectedImage(getProductImage(p));

        const colors = parseArray(p.product_colors || p.colors);
        if (colors.length === 1) setSelectedColor(colors[0]);

        const versions = parseVersions(p);
        if (versions.length === 1) setSelectedVersion(versions[0]);

        if (p.upsell_discount_item?.productId) {
          const upsellMatch = allProdRes.data?.find(item => item.id === p.upsell_discount_item.productId);
          if (upsellMatch) {
            let finalUpsellPrice = upsellMatch.sale_price || upsellMatch.price || 0;
            if (p.upsell_discount_item.discountType === 'percent') {
              finalUpsellPrice = finalUpsellPrice * (1 - p.upsell_discount_item.discountValue / 100);
            } else {
              finalUpsellPrice = Math.max(0, finalUpsellPrice - p.upsell_discount_item.discountValue);
            }
            setUpsellProductData({ ...upsellMatch, discountedPrice: Math.round(finalUpsellPrice) });
          }
        }
      }

      if (brandRes.data) setBrands(brandRes.data);
      if (kosherRes.data) setKosherList(kosherRes.data);
      if (allProdRes.data) setAllProducts(allProdRes.data);
    } catch (err) {
      console.error('Error fetching product:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseArray = (field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseVersions = (prod: any) => {
    const raw = prod.versions || prod.product_versions || prod.product_variants;
    return parseArray(raw);
  };

  const getProductImage = (p: any, colorImg?: string) => {
    if (colorImg && colorImg.trim().length > 0) return colorImg;
    if (p?.image_url && p.image_url.trim().length > 0) return p.image_url;
    const arr = parseArray(p?.images);
    return arr.length > 0 ? arr[0] : '';
  };

  const getKosherLogo = (p: any) => {
    const val = p?.kosher || '';
    if (!val) return '';
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'))) return val;
    const found = kosherList.find(k => k.name?.trim().toLowerCase() === String(val).trim().toLowerCase());
    return found?.image_url || found?.image || '';
  };

  const handleAddToCart = (includeUpsell = false, upsellItemObj: any = null) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const finalPrice = product.sale_price || product.price || 0;
      const versionExtra = typeof selectedVersion === 'object' ? (selectedVersion?.price_add || 0) : 0;
      const unitPrice = Number(finalPrice) + Number(versionExtra);

      const colorName = typeof selectedColor === 'object' ? selectedColor?.name : selectedColor || '';
      const versionName = typeof selectedVersion === 'object' ? selectedVersion?.name : selectedVersion || '';
      const activeImg = getProductImage(product, typeof selectedColor === 'object' ? selectedColor?.image : '') || selectedImage;

      const cartItem = {
        id: `${product.id}-${colorName}-${versionName}`,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        image: activeImg,
        color: colorName,
        version: versionName,
        quantity: quantity
      };

      const existingIndex = cart.findIndex((item: any) => item.id === cartItem.id);
      if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
      } else {
        cart.push(cartItem);
      }

      // הוספת מוצרים נלווים שתמיד באים יחד
      selectedBundles.forEach((bundle, idx) => {
        cart.push({
          id: `${product.id}-bundle-${idx}`,
          name: bundle.name,
          price: Number(bundle.price),
          image: activeImg,
          quantity: 1
        });
      });

      if (includeUpsell && upsellItemObj) {
        cart.push({
          id: `${upsellItemObj.id}-upsell`,
          productId: upsellItemObj.id,
          name: `${upsellItemObj.name} (מבצע נלווה 🎁)`,
          price: upsellItemObj.discountedPrice,
          image: getProductImage(upsellItemObj),
          quantity: 1
        });
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      setShowUpsellModal(false);
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 2500);
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  const handleBuyButtonClick = (isBuyNow = false) => {
    if (!isBuyNow && upsellProductData) {
      setShowUpsellModal(true);
    } else {
      handleAddToCart();
      if (isBuyNow) window.location.href = '/cart';
    }
  };

  if (loading) return <div className="text-center py-24 font-bold text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="text-center py-24 font-bold text-gray-500">המוצר אינו נמצא</div>;

  const currentBrandObj = brands.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
  const brandLogo = currentBrandObj?.image_url;
  const kosherLogo = getKosherLogo(product);
  const imagesList = parseArray(product.images);
  if (imagesList.length === 0 && product.image_url) imagesList.push(product.image_url);

  const colorsList = parseArray(product.product_colors || product.colors);
  const versionsList = parseVersions(product);
  const bundledList = parseArray(product.frequently_bought_together);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-orange-600 transition">
        <span>➔</span> חזרה לחנות
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border shadow-xs">
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border p-2 relative">
            <img src={(typeof selectedColor === 'object' ? selectedColor?.image : null) || selectedImage} alt="" className="w-full h-full object-contain" />
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
              {brandLogo && <div className="w-10 h-10 bg-white/90 rounded-2xl p-1.5 shadow border flex items-center justify-center"><img src={brandLogo} alt="" className="w-full h-full object-contain" /></div>}
              {kosherLogo && <div className="w-10 h-10 bg-white/90 rounded-2xl p-1.5 shadow border flex items-center justify-center"><img src={kosherLogo} alt="" className="w-full h-full object-contain" /></div>}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">{product.name}</h1>
            <div className="flex items-baseline gap-2">
              {product.sale_price ? (
                <>
                  <span className="text-2xl font-black text-red-600">₪{product.sale_price}</span>
                  <span className="text-sm text-gray-400 line-through">₪{product.price}</span>
                </>
              ) : (
                <span className="text-2xl font-black text-gray-900">₪{product.price}</span>
              )}
            </div>

            {/* הצגת אחריות ומשך אחריות */}
            {(product.warranty || product.warranty_duration) && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-blue-100">
                <span>🛡️</span>
                <span>אחריות: {product.warranty || 'יבואן רשמי'} {product.warranty_duration ? `(${product.warranty_duration})` : ''}</span>
              </div>
            )}

            <p className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-3.5 rounded-2xl border">{product.short_description || product.description}</p>
          </div>

          <div className="space-y-4 pt-4 border-t">
            {versionsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800">בחר גרסה</label>
                <div className="grid grid-cols-2 gap-2">
                  {versionsList.map((ver: any, idx: number) => (
                    <button key={idx} onClick={() => setSelectedVersion(ver)} className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${selectedVersion === ver ? 'border-orange-600 bg-orange-50 text-orange-900' : 'bg-white text-gray-700'}`}>
                      {typeof ver === 'string' ? ver : ver?.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800">בחר צבע</label>
                <div className="flex items-center gap-3">
                  {colorsList.map((col: any, idx: number) => (
                    <button key={idx} onClick={() => setSelectedColor(col)} className={`w-8 h-8 rounded-full transition-transform cursor-pointer shadow-sm ${selectedColor === col ? 'ring-2 ring-orange-600 ring-offset-2 scale-110' : 'border'}`} style={{ backgroundColor: typeof col === 'object' ? col.hex : '#000' }} />
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => handleBuyButtonClick(false)} className={`w-full py-3.5 rounded-2xl text-xs font-black text-white transition cursor-pointer shadow-md ${addedAnimation ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-700'}`}>
              {addedAnimation ? '✓ נוסף בהצלחה לעגלה!' : '🛒 הוספה לעגלה'}
            </button>
          </div>
        </div>
      </div>

      {/* מוצרים שתמיד באים יחד */}
      {bundledList.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-900 border-r-4 border-orange-600 pr-3">מוצרים שתמיד באים יחד</h3>
          <div className="space-y-3">
            {bundledList.map((item: any, index: number) => {
              const isChecked = selectedBundles.some(b => b.name === item.name);
              return (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3.5 rounded-2xl border">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📦</span>
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">{item.name}</h4>
                      <span className="text-xs font-black text-orange-600">₪{item.price}</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border shadow-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBundles([...selectedBundles, { name: item.name, price: Number(item.price) }]);
                        } else {
                          setSelectedBundles(selectedBundles.filter(b => b.name !== item.name));
                        }
                      }}
                      className="w-4 h-4 accent-orange-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold">הוסף לעסקה</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
