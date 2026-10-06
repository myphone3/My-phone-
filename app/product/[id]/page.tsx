'use client';

import React, { useEffect, useState, Suspense } from 'react';
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
  
  // לוגואים ונתונים נלווים
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);

  // ניהול תצוגת תיאור מלא ו-Upsell Popup
  const [showFullDescription, setShowFullDescription] = useState(false);
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
      if (colors.length > 0) setSelectedColor(colors[0]);

      const versions = parseSafeArray(data.versions || data.product_versions || data.product_variants);
      if (versions.length > 0) setSelectedVersion(versions[0]);

      // אם יש מוצר Upsell מוגדר, נביא את הפרטים שלו
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
  const versions = parseSafeArray(product.versions || product.product_versions || product.product_variants);
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

  const handleAddToCart = (skipUpsell = false) => {
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      {/* פירורי לחם וקטגוריה */}
      <div className="flex items-center justify-between text-xs font-bold text-gray-500">
        <Link href="/" className="hover:text-orange-600 transition flex items-center gap-1">
          <span>➔</span> חזרה לחנות
        </Link>
        {product.category && (
          <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full border border-orange-200">
            קטגוריה: {product.category}
          </span>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* תמונות עם לוגואים */}
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

        {/* פרטים ורכישה */}
        <div className="space-y-6">
          <div>
            <span className="text-orange-600 font-bold text-sm">{product.brand || ''}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1" dir="auto">{product.name}</h1>
          </div>

          {/* מחיר */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-gray-900">₪{finalPrice}</span>
            {product.sale_price && (
              <span className="text-sm text-gray-400 line-through">₪{product.price * quantity}</span>
            )}
          </div>

          {/* תיאור קצר */}
          {product.short_description && (
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed" dir="auto">
              {product.short_description}
            </p>
          )}

          {/* סמל אחריות */}
          {(product.warranty || product.warranty_duration) && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-2xl text-xs font-bold border border-blue-100">
              <span className="text-base">🛡️</span>
              <span>אחריות: {product.warranty || 'יבואן רשמי'} {product.warranty_duration ? `(${product.warranty_duration})` : ''}</span>
            </div>
          )}

          {/* בחירת צבע */}
          {colors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700">בחר צבע:</span>
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
                        isSelected ? 'border-2 border-orange-600 shadow-sm' : 'border border-gray-200'
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

          {/* בחירת גרסה */}
          {versions.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700">בחר גרסה / נפח:</span>
              <div className="flex flex-wrap gap-2">
                {versions.map((v: any, idx: number) => {
                  const vName = typeof v === 'object' ? v.name : v;
                  const isSelected = selectedVersion === v;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedVersion(v)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {vName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* בורר כמות */}
          <div className="flex items-center gap-4 pt-2">
            <span className="text-xs font-bold text-gray-700">כמות:</span>
            <div className="flex items-center border rounded-xl bg-gray-50 overflow-hidden shadow-xs">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="px-3.5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                -
              </button>
              <span className="px-4 py-2 text-xs font-black text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="px-3.5 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* כפתורי רכישה (הוסף לעגלה + קנה עכשיו) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleAddToCart(false)}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl font-black text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>הוסף לעגלה</span>
              <span>🛒</span>
            </button>
            <button
              onClick={handleBuyNow}
              className="w-full bg-black hover:bg-gray-900 text-white py-3.5 rounded-2xl font-black text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>קנה עכשיו</span>
              <span>⚡</span>
            </button>
          </div>

          {/* כפתורי שיתוף */}
          <div className="flex items-center gap-2 pt-2 border-t text-xs font-bold text-gray-600">
            <span>שתף מוצר:</span>
            <button onClick={() => handleShare('whatsapp')} className="bg-green-50 text-green-700 px-3 py-1.5 rounded-xl border border-green-200 hover:bg-green-100 transition cursor-pointer">
              💬 וואטסאפ
            </button>
            <button onClick={() => handleShare('copy')} className="bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition cursor-pointer">
              🔗 העתק קישור
            </button>
          </div>

        </div>
      </div>

      {/* תיאור מלא ומפרט */}
      {(product.description || product.specs) && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 border-r-4 border-orange-600 pr-3">תיאור ומפרט טכני</h3>
            <button
              onClick={() => setShowFullDescription(!showFullDescription)}
              className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
            >
              {showFullDescription ? 'הסתר תיאור מלא ▲' : 'הצג תיאור מלא ▼'}
            </button>
          </div>

          {showFullDescription && (
            <div className="space-y-6 text-xs sm:text-sm text-gray-700 leading-relaxed pt-2" dir="auto">
              {product.description && (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900">סקירה כללית</h4>
                  <div className="whitespace-pre-line">{product.description}</div>
                </div>
              )}
              {product.specs && (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-bold text-gray-900">מפרט טכני</h4>
                  <div className="whitespace-pre-line">{product.specs}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                      <h4 className="font-bold text-xs text-gray-900">{item.name || ''}</h4>
                      <span className="text-xs font-black text-orange-600">₪{item.price || 0}</span>
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

      {/* פופאפ (Upsell Modal) בעת הוספה לעגלה */}
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
