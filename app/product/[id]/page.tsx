'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [kosherList, setKosherList] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs'>('description');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // חלון קופץ למוצר בהנחה
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [upsellProductData, setUpsellProductData] = useState<any>(null);

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (productId) {
      fetchProductAndData();
    }
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
            setUpsellProductData({
              ...upsellMatch,
              discountedPrice: Math.round(finalUpsellPrice)
            });
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
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return field.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const parseVersions = (prod: any) => {
    const raw = prod.versions || prod.product_versions || prod.version_list || prod.options;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const getProductImage = (p: any, colorImg?: string) => {
    if (colorImg && typeof colorImg === 'string' && colorImg.trim().length > 0) return colorImg;
    if (p?.image_url && typeof p.image_url === 'string' && p.image_url.trim().length > 0) return p.image_url;
    if (Array.isArray(p?.images) && p.images.length > 0) return p.images[0];
    return '';
  };

  const getKosherLogo = (p: any) => {
    const val = p?.kosher || '';
    if (!val) return '';
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/'))) return val;
    const found = kosherList.find(k => k.name?.trim().toLowerCase() === String(val).trim().toLowerCase());
    return found?.image_url || found?.image || '';
  };

  const validateSelections = () => {
    setErrorMessage('');
    const colorsList = parseArray(product.product_colors || product.colors);
    const versionsList = parseVersions(product);

    if (colorsList.length > 1 && !selectedColor) {
      setErrorMessage('חובה לבחור צבע לפני הוספה לעגלה');
      return false;
    }
    if (versionsList.length > 0 && !selectedVersion) {
      setErrorMessage('חובה לבחור גרסה לפני הוספה לעגלה');
      return false;
    }
    return true;
  };

  // תיקון טיפוס הנתונים (הוספת : any ל-upsellItemObj)
  const handleAddToCart = (redirectAfter = false, includeUpsell = false, upsellItemObj: any = null) => {
    if (!validateSelections()) return;

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
        image_url: activeImg,
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

      if (includeUpsell && upsellItemObj) {
        const upsellCartItem = {
          id: `${upsellItemObj.id}-upsell`,
          productId: upsellItemObj.id,
          name: `${upsellItemObj.name} (מבצע נלווה 🎁)`,
          price: upsellItemObj.discountedPrice,
          image: getProductImage(upsellItemObj),
          image_url: getProductImage(upsellItemObj),
          quantity: 1
        };
        cart.push(upsellCartItem);
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));

      setShowUpsellModal(false);
      
      if (redirectAfter) {
        router.push('/cart');
      } else {
        setAddedAnimation(true);
        setTimeout(() => setAddedAnimation(false), 2500);
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  };

  const handleBuyButtonClick = (isBuyNow = false) => {
    if (!validateSelections()) return;
    if (!isBuyNow && upsellProductData) {
      setShowUpsellModal(true);
    } else {
      handleAddToCart(isBuyNow);
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

  const relatedIds = parseArray(product.related_products);
  const displayRelatedProducts = relatedIds.length > 0 
    ? allProducts.filter(p => relatedIds.includes(p.id)) 
    : allProducts.slice(0, 4);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-orange-600 transition">
        <span>➔</span> חזרה לחנות
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border shadow-xs">
        
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border p-2 relative">
            <img 
              src={(typeof selectedColor === 'object' ? selectedColor?.image : null) || selectedImage} 
              alt={product.name || ''} 
              className="w-full h-full object-contain"
            />

            <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
              {brandLogo && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-2xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={brandLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              {kosherLogo && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-2xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={kosherLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            {product.sale_price && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                מבצע ⚡
              </span>
            )}
          </div>

          {imagesList.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 px-1">
              {imagesList.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-gray-50 shrink-0 transition p-1 cursor-pointer ${selectedImage === img ? 'border-orange-600 scale-105' : 'border-gray-200 opacity-70'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            
            <div className="flex items-center gap-2 flex-wrap">
              {product.category && (
                <span className="text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {product.category}
                </span>
              )}
              {product.warranty && (
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1">
                  🛡️ אחריות: {product.warranty}
                </span>
              )}
            </div>

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

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              {product.short_description || product.description}
            </p>

          </div>

          <div className="space-y-4 pt-4 border-t">
            
            {versionsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800">
                  בחר גרסה <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {versionsList.map((ver: any, idx: number) => {
                    const verName = typeof ver === 'string' ? ver : ver?.name;
                    const isSelected = selectedVersion === ver || selectedVersion?.name === verName;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedVersion(ver)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                          isSelected ? 'border-orange-600 bg-orange-50 text-orange-900 shadow-xs' : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {verName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {colorsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800">
                  בחר צבע {colorsList.length > 1 && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center gap-3">
                  {colorsList.map((col: any, idx: number) => {
                    const colHex = typeof col === 'object' ? col.hex : '#000000';
                    const colName = typeof col === 'object' ? col.name : col;
                    const isSelected = selectedColor === col || selectedColor?.name === colName;
                    return (
                      <button
                        key={idx}
                        type="button"
                        title={colName}
                        onClick={() => setSelectedColor(col)}
                        className={`w-8 h-8 rounded-full transition-transform cursor-pointer relative shadow-sm ${
                          isSelected ? 'ring-2 ring-orange-600 ring-offset-2 scale-110' : 'border border-gray-300'
                        }`}
                        style={{ backgroundColor: colHex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border border-gray-200 rounded-2xl p-1.5 bg-gray-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs"
                >
                  -
                </button>
                <span className="text-sm font-black w-7 text-center text-gray-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => handleBuyButtonClick(true)}
                className="flex-1 py-3 rounded-2xl text-xs font-black transition shadow-sm cursor-pointer bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5"
              >
                <span>⚡</span> קנה עכשיו
              </button>
            </div>

            <button
              onClick={() => handleBuyButtonClick(false)}
              className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                addedAnimation ? 'bg-green-600 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              <span>🛒</span> {addedAnimation ? '✓ נוסף בהצלחה לעגלה!' : 'הוספה לעגלה'}
            </button>

            {errorMessage && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl text-center border border-red-100">
                {errorMessage}
              </p>
            )}

          </div>
        </div>

      </div>

      {showUpsellModal && upsellProductData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl text-center animate-in fade-in zoom-in duration-200" dir="rtl">
            <span className="text-3xl">🎁</span>
            <h3 className="text-lg font-black text-gray-900">הצעה מיוחדת עבורך!</h3>
            <p className="text-xs text-gray-600">הוספת את המוצר לעגלה. שדרג את הרכישה עם מוצר נלווה בהנחה בלעדית:</p>
            
            <div className="flex items-center gap-3 bg-orange-50/70 border border-orange-200 p-3.5 rounded-2xl text-right">
              <img src={getProductImage(upsellProductData)} alt="" className="w-16 h-16 object-contain bg-white rounded-xl border p-1" />
              <div className="flex-1 overflow-hidden">
                <h4 className="font-bold text-xs text-gray-900 truncate">{upsellProductData.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-black text-red-600">₪{upsellProductData.discountedPrice}</span>
                  <span className="text-xs text-gray-400 line-through">₪{upsellProductData.sale_price || upsellProductData.price}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleAddToCart(false, true, upsellProductData)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-xs font-black shadow-md cursor-pointer"
              >
                כן, הוסף את המוצר בהנחה לעגלה ➔
              </button>
              <button
                onClick={() => handleAddToCart(false, false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-bold cursor-pointer"
              >
                לא תודה, המשך לעגלה רגיל
              </button>
            </div>
          </div>
        </div>
      )}

      {displayRelatedProducts.length > 0 && (
        <div className="space-y-4 pt-6 border-t">
          <h2 className="text-lg font-black text-gray-900 border-r-4 border-orange-600 pr-3">מוצרים שאולי יעניינו אותך</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {displayRelatedProducts.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} className="bg-white p-3 rounded-2xl border shadow-xs hover:shadow-md transition block space-y-2">
                <div className="h-32 bg-gray-50 rounded-xl flex items-center justify-center p-1">
                  <img src={getProductImage(p)} alt={p.name} className="w-full h-full object-contain" />
                </div>
                <h4 className="font-bold text-xs text-gray-900 truncate">{p.name}</h4>
                <span className="text-xs font-black text-orange-600">₪{p.sale_price || p.price}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
