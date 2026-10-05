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
  const [loading, setLoading] = useState(true);
  
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs'>('description');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (productId) {
      fetchProductAndBrands();
    }
  }, [productId]);

  const fetchProductAndBrands = async () => {
    try {
      setLoading(true);
      const [prodRes, brandRes] = await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('brands').select('*')
      ]);

      if (prodRes.data) {
        const p = prodRes.data;
        setProduct(p);
        
        const primaryImg = p.image_url || (Array.isArray(p.images) ? p.images[0] : '') || '';
        setSelectedImage(primaryImg);

        const colors = parseArray(p.product_colors || p.colors);
        if (colors.length === 1) {
          setSelectedColor(colors[0]);
        } else {
          setSelectedColor(null);
        }

        const versions = parseVersions(p);
        if (versions.length === 1) {
          setSelectedVersion(versions[0]);
        } else {
          setSelectedVersion(null);
        }
      }
      if (brandRes.data) {
        setBrands(brandRes.data);
      }
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

  const getKosherImg = (p: any) => p?.kosher_image || p?.kosher || p?.kosher_logo || p?.kosher_badge || p?.kosher_img || '';

  const scrollToTabs = (tab: 'description' | 'specs' = 'description') => {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleAddToCart = (redirectAfter = false) => {
    if (!validateSelections()) return;

    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      const finalPrice = product.sale_price || product.price || 0;
      const versionExtra = typeof selectedVersion === 'object' ? (selectedVersion?.price_add || selectedVersion?.price || 0) : 0;
      const unitPrice = Number(finalPrice) + Number(versionExtra);

      const colorName = typeof selectedColor === 'object' ? selectedColor?.name : selectedColor || '';
      const versionName = typeof selectedVersion === 'object' ? selectedVersion?.name : selectedVersion || '';
      const activeImg = (typeof selectedColor === 'object' ? selectedColor?.image : null) || selectedImage;

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

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`היי, ראיתי את המוצר הזה ב-NEW PHONE: ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return <div className="text-center py-24 font-bold text-gray-500">טוען פרטי מוצר...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-24 space-y-4">
        <h2 className="text-xl font-black text-gray-800">המוצר אינו נמצא</h2>
        <Link href="/" className="inline-block bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold">
          חזרה לחנות ➔
        </Link>
      </div>
    );
  }

  const currentBrandObj = brands.find(b => b.name?.trim().toLowerCase() === product.brand?.trim().toLowerCase());
  const brandLogo = currentBrandObj?.image_url;
  const kosherImg = getKosherImg(product);

  const imagesList = parseArray(product.images);
  if (imagesList.length === 0 && product.image_url) {
    imagesList.push(product.image_url);
  }

  const colorsList = parseArray(product.product_colors || product.colors);
  const versionsList = parseVersions(product);
  const hasSpecs = Boolean(product.specifications && product.specifications.trim() !== '');
  const hasFullDesc = Boolean(product.full_description || product.description);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-orange-600 transition">
        <span>➔</span> חזרה לחנות
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border shadow-xs">
        
        {/* תמונות המוצר */}
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border p-2 relative">
            <img 
              src={(typeof selectedColor === 'object' ? selectedColor?.image : null) || selectedImage} 
              alt={product.name || ''} 
              className="w-full h-full object-contain"
            />

            {/* לוגו מותג ולוגו כשרות בצד התמונה */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
              {brandLogo && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-2xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={brandLogo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              {kosherImg && (
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-2xl p-1.5 shadow border border-gray-100 flex items-center justify-center">
                  <img src={kosherImg} alt="" className="w-full h-full object-contain" />
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
            <div className="flex gap-2 overflow-x-auto pb-2">
              {imagesList.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-gray-50 shrink-0 transition ${selectedImage === img ? 'border-orange-600 scale-105' : 'border-gray-200 opacity-70'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר */}
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            
            {/* קטגוריה ואחריות */}
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

            {/* מחיר */}
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

            {/* תיאור קצר */}
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              {product.short_description || product.description}
            </p>

            {/* כפתורי מעבר לתיאור ומפרט */}
            <div className="flex gap-2">
              {hasFullDesc && (
                <button
                  onClick={() => scrollToTabs('description')}
                  className="flex-1 bg-gray-100 hover:bg-orange-50 hover:text-orange-700 text-gray-800 py-2.5 px-4 rounded-xl text-xs font-bold border border-gray-200 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>📖</span> תיאור מלא על המוצר
                </button>
              )}
              {hasSpecs && (
                <button
                  onClick={() => scrollToTabs('specs')}
                  className="flex-1 bg-gray-100 hover:bg-orange-50 hover:text-orange-700 text-gray-800 py-2.5 px-4 rounded-xl text-xs font-bold border border-gray-200 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>⚙️</span> מעבר למפרט מלא
                </button>
              )}
            </div>

            {/* שיתוף מוצר */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-gray-500 block">שיתוף מוצר:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWhatsAppShare}
                  title="שתף בוואטסאפ"
                  className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition shadow-sm cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                </button>
                <button
                  onClick={handleCopyLink}
                  title="העתק קישור"
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition shadow-sm cursor-pointer relative"
                >
                  🔗
                  {copied && (
                    <span className="absolute -top-8 bg-black text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                      הועתק!
                    </span>
                  )}
                </button>
              </div>
            </div>

          </div>

          <div className="space-y-4 pt-4 border-t">
            
            {/* בחירת גרסה */}
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
                          isSelected 
                            ? 'border-orange-600 bg-orange-50 text-orange-900 shadow-xs' 
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {verName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* בחירת צבע */}
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
                          isSelected ? 'ring-2 ring-orange-600 ring-offset-2 scale-110' : 'border border-gray-300 hover:scale-105'
                        }`}
                        style={{ backgroundColor: colHex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* בחירת כמות */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800">כמות</label>
              <div className="flex items-center justify-between border border-gray-200 rounded-2xl p-2 bg-gray-50/50 max-w-[140px]">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs transition"
                >
                  -
                </button>
                <span className="text-sm font-black w-8 text-center text-gray-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs transition"
                >
                  +
                </button>
              </div>
            </div>

            {errorMessage && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl text-center border border-red-100">
                {errorMessage}
              </p>
            )}

            {/* כפתורי הוספה לעגלה וקנה עכשיו */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => handleAddToCart(false)}
                className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                  addedAnimation 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span>🛒</span> {addedAnimation ? '✓ נוסף בהצלחה לעגלה!' : 'הוסף לעגלה'}
              </button>

              <button
                onClick={() => handleAddToCart(true)}
                className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-md cursor-pointer bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <span>⚡</span> קנה עכשיו
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* לשוניות תיאור מלא ומפרט מלא */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border shadow-xs space-y-6" ref={tabsRef}>
        <div className="flex border-b gap-6">
          {hasFullDesc && (
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition cursor-pointer ${
                activeTab === 'description' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              תיאור מלא
            </button>
          )}
          
          {hasSpecs && (
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition cursor-pointer ${
                activeTab === 'specs' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              מפרט מלא
            </button>
          )}
        </div>

        <div className="text-xs sm:text-sm text-gray-700 leading-relaxed min-h-[120px]">
          {activeTab === 'description' ? (
            <div className="whitespace-pre-line space-y-2">
              {product.full_description || product.description || 'אין תיאור מלא זמין עבור מוצר זה.'}
            </div>
          ) : (
            <div className="whitespace-pre-line space-y-2">
              {product.specifications || 'אין מפרט טכני זמין עבור מוצר זה.'}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
