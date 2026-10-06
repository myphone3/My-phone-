'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ProductDetailContent() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<{ name: string; price: number }[]>([]);
  
  // מצב פתיחה של מוצרים שתמיד באים יחד
  const [showBundles, setShowBundles] = useState(false);

  // נתונים נוספים
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  // ניהול לשוניות ותצוגה
  const [activeTab, setActiveTab] = useState<'desc' | 'specs'>('desc');
  const detailsRef = useRef<HTMLDivElement>(null);

  // פופאפ מבצע Upsell
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [upsellTargetProduct, setUpsellTargetProduct] = useState<any>(null);

  useEffect(() => {
    if (productId) {
      fetchProductAndMetaData();
    }
  }, [productId]);

  const parseSafeArray = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const fetchProductAndMetaData = async () => {
    try {
      setLoading(true);

      const [prodRes, brandRes, kosherRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('brands').select('*'),
        supabase.from('kosher_options').select('*')
      ]);

      if (prodRes.error || !prodRes.data) {
        setProduct(null);
        return;
      }

      const data = prodRes.data;
      setProduct(data);
      if (brandRes.data) setBrandsList(brandRes.data);
      if (kosherRes.data) setKosherList(kosherRes.data);

      const imagesArr = parseSafeArray(data.images);
      setActiveImage(data.image_url || (imagesArr.length > 0 ? imagesArr[0] : ''));

      const colors = parseSafeArray(data.product_colors || data.colors);
      if (colors.length > 0) setSelectedColor(null);

      const rawVersions = data.product_variants || data.versions || data.product_versions || data.variants;
      const versionsArr = parseSafeArray(rawVersions);
      if (versionsArr.length > 0) setSelectedVersion(null);

      // שליפת מוצרים שיעניינו אותך
      const relatedIds = parseSafeArray(data.related_products);
      if (relatedIds.length > 0) {
        const { data: relData } = await supabase
          .from('products')
          .select('*')
          .in('id', relatedIds);
        if (relData) setRelatedProducts(relData);
      }

      if (data.upsell_discount_item && data.upsell_discount_item.productId) {
        const { data: upsellData } = await supabase
          .from('products')
          .select('*')
          .eq('id', data.upsell_discount_item.productId)
          .single();
        if (upsellData) setUpsellTargetProduct(upsellData);
      }

    } catch (err) {
      console.error('Error fetching product details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-32 text-gray-500 font-medium">טוען פרטי מוצר...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-32 space-y-4" dir="rtl">
        <h2 className="text-2xl font-bold text-gray-800">המוצר לא נמצא</h2>
        <Link href="/" className="inline-block bg-orange-600 text-white px-6 py-2 rounded-2xl font-bold">
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  const colors = parseSafeArray(product.product_colors || product.colors);
  const rawVersions = product.product_variants || product.versions || product.product_versions || product.variants;
  const versions = parseSafeArray(rawVersions);
  const bundledList = parseSafeArray(product.frequently_bought_together);
  const imagesList = parseSafeArray(product.images);

  const currentBrandObj = brandsList.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
  const brandLogo = currentBrandObj?.image_url;

  const kosherVal = product.kosher || product.kosher_certification || product.kosher_name || '';
  const kosherObj = kosherList.find(k => k.name?.trim().toLowerCase() === String(kosherVal).trim().toLowerCase());
  const kosherLogo = kosherObj?.image_url || kosherObj?.image || (typeof kosherVal === 'string' && kosherVal.startsWith('http') ? kosherVal : '');

  const basePrice = Number(product.sale_price || product.price || 0);
  const versionExtra = selectedVersion && typeof selectedVersion === 'object' ? Number(selectedVersion.price_add || selectedVersion.price || 0) : 0;
  const finalPrice = (basePrice + versionExtra) * quantity;

  const validateSelections = () => {
    if (colors.length > 0 && !selectedColor) {
      alert('נא לבחור צבע ממגוון הצבעים הזמינים');
      return false;
    }
    if (versions.length > 0 && !selectedVersion) {
      alert('נא לבחור גרסה / נפח');
      return false;
    }
    return true;
  };

  const handleAddToCart = (skipUpsell = false) => {
    if (!validateSelections()) return;

    try {
      if (!skipUpsell && product.upsell_discount_item && upsellTargetProduct) {
        setShowUpsellModal(true);
        return;
      }

      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const colorName = typeof selectedColor === 'object' ? selectedColor?.name : selectedColor || '';
      const versionName = typeof selectedVersion === 'object' ? selectedVersion?.name : selectedVersion || '';

      const cartItem = {
        id: `${product.id}-${colorName}-${versionName}`,
        productId: product.id,
        name: product.name,
        price: basePrice + versionExtra,
        image: activeImage || product.image_url || '',
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

      selectedBundles.forEach((bundle, idx) => {
        cart.push({
          id: `${product.id}-bundle-${idx}`,
          name: bundle.name,
          price: Number(bundle.price),
          image: activeImage,
          quantity: 1
        });
      });

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      alert('המוצר נוסף בהצלחה לעגלה! 🛒');
      setShowUpsellModal(false);
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  const handleBuyNow = () => {
    if (!validateSelections()) return;
    handleAddToCart(true);
    router.push('/cart');
  };

  const handleAddUpsellToCart = () => {
    if (!upsellTargetProduct) return;
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const discountItem = product.upsell_discount_item;
      let upsellPrice = upsellTargetProduct.sale_price || upsellTargetProduct.price || 0;

      if (discountItem) {
        if (discountItem.discountType === 'percent') {
          upsellPrice = upsellPrice * (1 - (Number(discountItem.discountValue) || 0) / 100);
        } else {
          upsellPrice = Math.max(0, upsellPrice - (Number(discountItem.discountValue) || 0));
        }
      }

      cart.push({
        id: `${upsellTargetProduct.id}-upsell`,
        productId: upsellTargetProduct.id,
        name: `${upsellTargetProduct.name} (הטבת מבצע)`,
        price: upsellPrice,
        image: upsellTargetProduct.image_url || '',
        quantity: 1
      });

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (err) {
      console.error('Upsell add error:', err);
    }
    handleAddToCart(true);
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `תראה איזה מוצר מדהים מצאתי ב-NEW PHONE: ${product.name}`;
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else {
      navigator.clipboard.writeText(url);
      alert('קישור הועתק בהצלחה ללוח! 📋');
    }
  };

  const scrollToDetails = () => {
    if (detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      {/* פירורי לחם (Breadcrumbs) מעל התמונה */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-white/60 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-gray-100 shadow-xs">
        <Link href="/" className="hover:text-orange-600 transition">דף הבית</Link>
        {product.category && (
          <>
            <span className="text-gray-300">/</span>
            <Link href={`/category/${encodeURIComponent(product.category)}`} className="hover:text-orange-600 transition">
              {product.category}
            </Link>
          </>
        )}
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 truncate max-w-[220px]" title={product.name}>{product.name}</span>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* תמונות המוצר */}
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl flex items-center justify-center p-4 relative overflow-hidden">
            <img src={activeImage} alt={product.name} className="max-h-full max-w-full object-contain" />

            {/* לוגו מותג וכשרות */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
              {brandLogo && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={brandLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              {kosherLogo && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={kosherLogo} alt="Kosher" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
          </div>

          {imagesList.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {imagesList.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-16 h-16 rounded-xl border overflow-hidden shrink-0 bg-gray-50 p-1 cursor-pointer transition ${activeImage === img ? 'border-orange-600 ring-2 ring-orange-600/30' : 'border-gray-200'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר ורכישה */}
        <div className="space-y-6">
          
          {/* קטגוריה ואחריות */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {product.category && (
              <span className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                {product.category}
              </span>
            )}
            {product.warranty && (
              <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1">
                🛡 אחריות: {product.warranty} {product.warranty_duration ? `(${product.warranty_duration})` : ''}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-snug" dir="auto">{product.name}</h1>
          </div>

          {/* מחיר */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-gray-900">₪{finalPrice}</span>
            {product.sale_price && (
              <span className="text-sm text-gray-400 line-through">₪{product.price * quantity}</span>
            )}
          </div>

          {/* בחירת צבע (חובה) */}
          {colors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700">בחר צבע <span className="text-gray-400 font-normal">(חובה)</span>:</span>
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {colors.map((c: any, idx: number) => {
                  const colorName = typeof c === 'object' ? c.name : c;
                  const colorImg = typeof c === 'object' ? (c.image_url || c.image) : '';
                  const colorHex = typeof c === 'object' ? (c.hex || c.code) : '';
                  const isSelected = selectedColor === c;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedColor(c);
                        if (colorImg) setActiveImage(colorImg);
                      }}
                      className={`w-9 h-9 rounded-xl transition relative flex items-center justify-center shrink-0 cursor-pointer bg-white ${
                        isSelected ? 'border-2 border-orange-600 shadow-sm ring-2 ring-orange-600/20' : 'border border-gray-200'
                      }`}
                      style={{ backgroundColor: colorImg ? 'transparent' : (colorHex || '#ccc') }}
                      title={colorName}
                    >
                      {colorImg && <img src={colorImg} alt="" className="w-full h-full object-cover rounded-lg" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* בחירת גרסה (חובה אם קיימת) */}
          {versions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700">בחר גרסה / נפח <span className="text-gray-400 font-normal">(חובה)</span>:</span>
              <div className="flex flex-wrap gap-2">
                {versions.map((v: any, idx: number) => {
                  const vName = typeof v === 'object' ? (v.name || v.title || v.label) : v;
                  const isSelected = selectedVersion === v;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedVersion(v)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        isSelected ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {vName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* מוצרים שתמיד באים יחד (אקורדיון סגור כברירת מחדל) */}
          {bundledList.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <button
                onClick={() => setShowBundles(!showBundles)}
                className="w-full flex items-center justify-between text-xs font-black text-gray-900 bg-gray-50 hover:bg-gray-100 p-3 rounded-xl transition cursor-pointer"
              >
                <span>מוצרים שתמיד באים יחד</span>
                <span className="text-orange-600">{showBundles ? '▲' : '▼'}</span>
              </button>

              {showBundles && (
                <div className="space-y-1.5 pt-1">
                  {bundledList.map((item: any, index: number) => {
                    const isChecked = selectedBundles.some(b => b.name === item.name);
                    return (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl border text-xs">
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1">
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
                          <span className="font-bold text-gray-900 truncate">{item.name || ''}</span>
                        </label>
                        <span className="font-black text-orange-600">₪{item.price || 0}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* שורה מאוחדת: כפתור "קנה עכשיו" ירוק + בורר כמות */}
          <div className="grid grid-cols-12 gap-3 pt-2">
            <button
              onClick={handleBuyNow}
              className="col-span-8 bg-green-600 hover:bg-green-700 text-white py-3.5 px-4 rounded-2xl font-black text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>קנה עכשיו</span>
              <span>⚡</span>
            </button>

            <div className="col-span-4 flex items-center justify-between border rounded-2xl bg-gray-50 px-2 overflow-hidden shadow-xs">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="p-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                -
              </button>
              <span className="text-xs font-black text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="p-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* כפתור הוספה לעגלה כתום רחב */}
          <button
            onClick={() => handleAddToCart(false)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span>הוספה לעגלה</span>
            <span>🛒</span>
          </button>

          {/* כפתורי שיתוף מעל התיאור הקצר */}
          <div className="flex items-center justify-between pt-4 border-t text-xs font-bold text-gray-600">
            <span>שיתוף מוצר:</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleShare('whatsapp')} 
                className="w-9 h-9 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl border border-emerald-200 transition cursor-pointer flex items-center justify-center shadow-xs"
                title="שתף בוואטסאפ"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
              </button>
              <button 
                onClick={() => handleShare('copy')} 
                className="w-9 h-9 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl border border-gray-200 transition cursor-pointer flex items-center justify-center shadow-xs"
                title="העתק קישור"
              >
                <span className="text-base">🔗</span>
              </button>
            </div>
          </div>

          {/* תיאור קצר + כפתור מעבר לתיאור המלא */}
          <div className="space-y-4 pt-4 border-t">
            {product.short_description && (
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100" dir="auto">
                {product.short_description}
              </p>
            )}

            {(product.description || product.specs) && (
              <button
                onClick={scrollToDetails}
                className="w-full bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 py-2.5 px-4 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <span>לתיאור מלא על המוצר</span>
                <span>▼</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* מוצרים אולי יעניינו אותך */}
      {relatedProducts.length > 0 && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6">
          <h3 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">מוצרים שאולי יעניינו אותך</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relatedProducts.map((relProd) => (
              <Link 
                key={relProd.id} 
                href={`/product/${relProd.id}`}
                className="bg-gray-50 p-3 rounded-2xl border border-gray-100 hover:shadow-md transition flex flex-col justify-between group"
              >
                <div className="h-32 w-full bg-white rounded-xl flex items-center justify-center p-2 overflow-hidden">
                  <img src={relProd.image_url || relProd.images?.[0]} alt="" className="h-full object-contain group-hover:scale-105 transition" />
                </div>
                <div className="mt-2 space-y-1">
                  <h4 className="font-bold text-xs text-gray-900 text-right group-hover:text-orange-600 transition" dir="auto">{relProd.name}</h4>
                  <span className="text-xs font-black text-orange-600 block text-right">₪{relProd.sale_price || relProd.price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* אזור לשוניות (תיאור מלא / מפרט מלא) מתחת למוצרים שאולי יעניינו אותך */}
      {(product.description || product.specs) && (
        <div ref={detailsRef} className="bg-white p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6 scroll-mt-6">
          <div className="flex border-b gap-4">
            {product.description && (
              <button
                onClick={() => setActiveTab('desc')}
                className={`pb-3 text-sm font-black transition cursor-pointer border-b-2 ${
                  activeTab === 'desc' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                תיאור מלא
              </button>
            )}
            {product.specs && (
              <button
                onClick={() => setActiveTab('specs')}
                className={`pb-3 text-sm font-black transition cursor-pointer border-b-2 ${
                  activeTab === 'specs' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                מפרט טכני מלא
              </button>
            )}
          </div>

          <div className="text-xs sm:text-sm text-gray-700 leading-relaxed" dir="auto">
            {activeTab === 'desc' && product.description && (
              <div className="whitespace-pre-line">{product.description}</div>
            )}
            {activeTab === 'specs' && product.specs && (
              <div className="whitespace-pre-line">{product.specs}</div>
            )}
          </div>
        </div>
      )}

      {/* פופאפ Upsell */}
      {showUpsellModal && upsellTargetProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl text-center">
            <span className="text-3xl">🎁</span>
            <div className="space-y-1">
              <h3 className="font-black text-base text-gray-900">הצעה מיוחדת בשבילך!</h3>
              <p className="text-xs text-gray-500">הוסף את המוצר הנלווה הבא להזמנה שלך במחיר מיוחד:</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border flex items-center gap-3 text-right">
              <img src={upsellTargetProduct.image_url} alt="" className="w-16 h-16 object-contain bg-white rounded-xl border p-1" />
              <div>
                <h4 className="font-bold text-xs text-gray-900">{upsellTargetProduct.name}</h4>
                <span className="text-xs font-black text-orange-600">
                  ₪{upsellTargetProduct.sale_price || upsellTargetProduct.price}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleAddToCart(true)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                לא תודה, המשך לעגלה
              </button>
              <button
                onClick={handleAddUpsellToCart}
                className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl text-xs font-bold cursor-pointer transition shadow-md"
              >
                הוסף והמשך ➔
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="text-center py-32 text-gray-500 font-medium">טוען...</div>}>
      <ProductDetailContent />
    </Suspense>
  );
}
