'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function ProductDetailContent() {
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<{ name: string; price: number }[]>([]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // פונקציית עזר בטוחה לפענוח מערכים מ-Supabase
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

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !data) {
        console.error('Product not found:', error);
        setProduct(null);
        return;
      }

      setProduct(data);

      const imagesArr = parseSafeArray(data.images);
      setActiveImage(data.image_url || (imagesArr.length > 0 ? imagesArr[0] : ''));

      const colors = parseSafeArray(data.product_colors || data.colors);
      if (colors.length > 0) setSelectedColor(colors[0]);

      const versions = parseSafeArray(data.versions || data.product_versions || data.product_variants);
      if (versions.length > 0) setSelectedVersion(versions[0]);

    } catch (err) {
      console.error('Error fetching product:', err);
      setProduct(null);
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

  const basePrice = Number(product.sale_price || product.price || 0);
  const versionExtra = selectedVersion && typeof selectedVersion === 'object' ? Number(selectedVersion.price_add || selectedVersion.price || 0) : 0;
  const finalPrice = basePrice + versionExtra;

  const handleAddToCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const colorName = typeof selectedColor === 'object' ? selectedColor?.name : selectedColor || '';
      const versionName = typeof selectedVersion === 'object' ? selectedVersion?.name : selectedVersion || '';

      const cartItem = {
        id: `${product.id}-${colorName}-${versionName}`,
        productId: product.id,
        name: product.name,
        price: finalPrice,
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

      // הוספת מוצרים נלווים שתמיד באים יחד
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
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-orange-600 transition">
        <span>➔</span> חזרה לחנות
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* תמונות */}
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl flex items-center justify-center p-4">
            <img src={activeImage} alt={product.name} className="max-h-full max-w-full object-contain" />
          </div>
        </div>

        {/* פרטים ורכישה */}
        <div className="space-y-6">
          <div>
            <span className="text-orange-600 font-bold text-sm">{product.brand || ''}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{product.name}</h1>
          </div>

          <div className="text-2xl font-black text-gray-900">
            ₪{finalPrice}
          </div>

          {/* אחריות */}
          {(product.warranty || product.warranty_duration) && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-blue-100">
              <span>🛡️</span>
              <span>אחריות: {product.warranty || 'יבואן רשמי'} {product.warranty_duration ? `(${product.warranty_duration})` : ''}</span>
            </div>
          )}

          {/* בחירת צבע */}
          {colors.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-bold text-gray-700">בחר צבע:</span>
              <div className="flex items-center gap-2">
                {colors.map((c: any, idx: number) => {
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
                      className={`w-8 h-8 rounded-full border transition relative flex items-center justify-center cursor-pointer ${
                        isSelected ? 'ring-2 ring-orange-600 ring-offset-2' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: colorHex || '#ccc' }}
                    >
                      {colorImg && <img src={colorImg} alt="" className="w-full h-full object-cover rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* בחירת גרסה */}
          {versions.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-bold text-gray-700">בחר גרסה / נפח:</span>
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

          {/* כפתור הוספה לעגלה */}
          <button
            onClick={handleAddToCart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-base transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <span>הוסף לעגלה</span>
            <span>🛒</span>
          </button>
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
