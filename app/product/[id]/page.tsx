'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ProductPage() {
  const params = useParams();
  const productId = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'specs'>('description');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

        const colors = parseArray(p.product_colors);
        if (colors.length > 0) setSelectedColor(colors[0]);

        const versions = parseArray(p.versions || p.product_versions);
        if (versions.length > 0) setSelectedVersion(versions[0]);
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

  // פונקציית עזר בטוחה המונעת קריסה אם הנתונים במסד אינם מערך תקין
  const parseArray = (field: any) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const scrollToTabs = () => {
    tabsRef.current?.scrollIntoView({ behavior: 'smooth' });
    setActiveTab('description');
  };

  const handleAddToCart = () => {
    setErrorMessage('');
    if (!product) return;

    const versionsList = parseArray(product.versions || product.product_versions);
    if (versionsList.length > 0 && !selectedVersion) {
      setErrorMessage('חובה לבחור גרסה לפני הוספה לעגלה');
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      const finalPrice = product.sale_price || product.price || 0;
      const versionExtra = selectedVersion?.price_add || selectedVersion?.price || 0;
      const unitPrice = Number(finalPrice) + Number(versionExtra);

      const cartItem = {
        id: `${product.id}-${selectedColor?.name || 'default'}-${selectedVersion?.name || 'default'}`,
        productId: product.id,
        name: product.name,
        price: unitPrice,
        image: selectedColor?.image || selectedImage,
        color: selectedColor?.name || '',
        version: typeof selectedVersion === 'object' ? selectedVersion?.name : selectedVersion || '',
        quantity: 1
      };

      const existingIndex = cart.findIndex((item: any) => item.id === cartItem.id);
      if (existingIndex > -1) {
        cart[existingIndex].quantity += 1;
      } else {
        cart.push(cartItem);
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 2500);
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
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

  const imagesList = parseArray(product.images);
  if (imagesList.length === 0 && product.image_url) {
    imagesList.push(product.image_url);
  }

  const colorsList = parseArray(product.product_colors);
  const versionsList = parseArray(product.versions || product.product_versions);
  const hasSpecs = Boolean(product.specifications && product.specifications.trim() !== '');

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
              src={selectedColor?.image || selectedImage} 
              alt={product.name || ''} 
              className="w-full h-full object-contain"
            />
            {product.sale_price && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow">
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
          <div className="space-y-3">
            
            {/* לוגו מותג ולוגו כשרות */}
            <div className="flex items-center gap-3">
              {brandLogo ? (
                <div className="h-8 max-w-[100px] flex items-center">
                  <img src={brandLogo} alt={product.brand || 'Brand'} className="max-h-full max-w-full object-contain" />
                </div>
              ) : product.brand ? (
                <span className="text-xs font-bold bg-orange-50 text-orange-800 px-3 py-1 rounded-full border border-orange-200">
                  {product.brand}
                </span>
              ) : null}

              {product.kosher_image && (
                <div className="h-8 max-w-[90px] flex items-center" title="כשרות">
                  <img src={product.kosher_image} alt="כשרות" className="max-h-full max-w-full object-contain" />
                </div>
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

            {/* כפתור מעבר מהיר ללשונית תיאור מלא */}
            <div>
              <button
                onClick={scrollToTabs}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>📖</span> תיאור מלא על המוצר ומפרט טכני
              </button>
            </div>

          </div>

          <div className="space-y-4 pt-4 border-t">
            
            {/* בחירת גרסה (חובה) */}
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

            {/* בחירת צבע (עיגולי צבע בלבד) */}
            {colorsList.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800">בחר צבע</label>
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

            {/* הודעת שגיאה במידה ולא נבחרה גרסה */}
            {errorMessage && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-xl text-center">
                {errorMessage}
              </p>
            )}

            {/* כפתור הוספה לעגלה */}
            <button
              onClick={handleAddToCart}
              className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-md cursor-pointer ${
                addedAnimation 
                  ? 'bg-green-600 text-white' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`}
            >
              {addedAnimation ? '✓ נוסף בהצלחה לעגלה!' : 'הוספה לעגלה 🛒'}
            </button>

          </div>
        </div>

      </div>

      {/* לשוניות תיאור מלא ומפרט מלא */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border shadow-xs space-y-6" ref={tabsRef}>
        <div className="flex border-b gap-6">
          <button
            onClick={() => setActiveTab('description')}
            className={`pb-3 text-xs sm:text-sm font-black border-b-2 transition cursor-pointer ${
              activeTab === 'description' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            תיאור מלא
          </button>
          
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
              {product.specifications}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
