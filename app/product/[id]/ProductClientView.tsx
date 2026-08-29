'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ProductClientView({ product, relatedProducts, promoProduct }: { product: any; relatedProducts: any[]; promoProduct: any }) {
  let allImages: string[] = [];
  if (product.image_url) allImages.push(product.image_url);
  
  let gallery: string[] = [];
  if (Array.isArray(product.image_urls)) {
    gallery = product.image_urls;
  } else if (typeof product.image_urls === 'string') {
    try { gallery = JSON.parse(product.image_urls); } catch (e) { gallery = product.image_urls.split(',').map((s: string) => s.trim()).filter(Boolean); }
  }
  allImages.push(...gallery);
  allImages = Array.from(new Set(allImages));

  const [selectedImage, setSelectedImage] = useState<string>(allImages[0] || '');
  
  const versionList = typeof product.version === 'string' ? product.version.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
  const storageList = typeof product.storage === 'string' ? product.storage.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  const colorList = typeof product.colors === 'string' ? product.colors.split(',').map((c: string) => c.trim()).filter(Boolean) : [];

  let colorImagesMap = product.color_images;
  if (typeof colorImagesMap === 'string') {
    try { colorImagesMap = JSON.parse(colorImagesMap); } catch (e) { colorImagesMap = {}; }
  }
  colorImagesMap = colorImagesMap || {};

  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedStorage, setSelectedStorage] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);

  const handleColorSelect = (color: string) => {
    const trimmedColor = color.trim();
    setSelectedColor(trimmedColor);
    if (colorImagesMap[trimmedColor]) {
      setSelectedImage(colorImagesMap[trimmedColor]);
    }
  };

  const addToCartInternal = (itemToAdd: any) => {
    try {
      const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
      const existingIndex = existingCart.findIndex((i: any) => 
        i.id === itemToAdd.id && 
        i.selectedVersion === itemToAdd.selectedVersion && 
        i.selectedStorage === itemToAdd.selectedStorage && 
        i.selectedColor === itemToAdd.selectedColor
      );

      if (existingIndex > -1) {
        existingCart[existingIndex].quantity = (Number(existingCart[existingIndex].quantity) || 1) + 1;
      } else {
        existingCart.push({ ...itemToAdd, quantity: 1 });
      }

      localStorage.setItem('cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToCart = () => {
    if (versionList.length > 0 && !selectedVersion) {
      alert('אנא בחר גרסה לפני הוספה לסל');
      return;
    }
    if (storageList.length > 0 && !selectedStorage) {
      alert('אנא בחר נפח אחסון לפני הוספה לסל');
      return;
    }
    if (colorList.length > 0 && !selectedColor) {
      alert('אנא בחר צבע לפני הוספה לסל');
      return;
    }

    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      selectedVersion,
      selectedStorage,
      selectedColor,
    };

    addToCartInternal(cartItem);

    if (promoProduct) {
      setShowPromoModal(true);
    } else {
      alert('המוצר נוסף לסל בהצלחה! 🛒');
    }
  };

  const handleAddPromoToCart = () => {
    if (!promoProduct) return;
    addToCartInternal({
      id: promoProduct.id,
      name: promoProduct.name,
      price: promoProduct.price,
    });
    setShowPromoModal(false);
    alert('מוצר המבצע נוסף לסל בהצלחה! 🎁');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 md:p-8 rounded-3xl shadow-sm border">
        
        {/* גלריית תמונות */}
        <div className="space-y-4">
          <div className="w-full h-96 bg-gray-50 rounded-2xl overflow-hidden border flex items-center justify-center">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="w-full h-full object-contain p-2 transition duration-200" />
            ) : (
              <span className="text-gray-400">אין תמונה זמינה</span>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allImages.map((img: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition flex-shrink-0 ${selectedImage === img ? 'border-black' : 'border-transparent opacity-70'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {product.category && (
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full border">
                {product.categoryImage ? <img src={product.categoryImage} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span>📁</span>}
                <span className="text-xs font-semibold text-gray-800">{product.category}</span>
              </div>
            )}
            {product.brand && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                {product.brandImage ? <img src={product.brandImage} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span>🏷️</span>}
                <span className="text-xs font-semibold text-blue-800">{product.brand}</span>
              </div>
            )}
            {product.kosher && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                {product.kosherImage ? <img src={product.kosherImage} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span>⭐</span>}
                <span className="text-xs font-semibold text-green-800">כשרות: {product.kosher}</span>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900">{product.name}</h1>
          <div className="text-3xl font-black text-black">₪{product.price}</div>

          {versionList.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <label className="block text-xs font-bold text-gray-700">בחר גרסה (שדה חובה):</label>
              <div className="flex flex-wrap gap-2">
                {versionList.map((version: string) => (
                  <button
                    key={version}
                    onClick={() => setSelectedVersion(version)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${selectedVersion === version ? 'bg-black text-white border-black shadow-sm' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {version}
                  </button>
                ))}
              </div>
            </div>
          )}

          {storageList.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-700">בחר נפח אחסון (שדה חובה):</label>
              <div className="flex flex-wrap gap-2">
                {storageList.map((storage: string) => (
                  <button
                    key={storage}
                    onClick={() => setSelectedStorage(storage)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${selectedStorage === storage ? 'bg-black text-white border-black shadow-sm' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {storage}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colorList.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-gray-700">בחר צבע (שדה חובה):</label>
              <div className="flex flex-wrap gap-2">
                {colorList.map((color: string) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${selectedColor === color ? 'bg-black text-white border-black shadow-sm' : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.warranty && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-3">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="font-black text-amber-950">אחריות:</div>
                <div className="mt-0.5 text-amber-900">{product.warranty}</div>
              </div>
            </div>
          )}

          {product.short_description && (
            <p className="text-gray-600 text-base leading-relaxed pt-2">{product.short_description}</p>
          )}

          <div className="pt-4 border-t">
            <button 
              onClick={handleAddToCart}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition shadow-lg text-base"
            >
              הוספה לסל 🛒
            </button>
          </div>
        </div>
      </div>

      {/* תיאור ומפרט */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {product.description && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">תיאור המוצר:</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed">{product.description}</div>
          </div>
        )}
        {product.specs && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">מפרט טכני</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-xl font-mono text-sm">{product.specs}</div>
          </div>
        )}
      </div>

      {/* פריטים שאולי יעניינו אותך */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 space-y-6">
          <h2 className="text-2xl font-black text-gray-900 text-center">מוצרים נוספים שאולי יעניינו אותך ⭐</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((item) => (
              <Link key={item.id} href={`/product/${item.id}`} className="bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="w-full h-40 bg-gray-50 rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                    <img src={item.image_url || item.image_urls?.[0]} alt={item.name} className="w-full h-full object-contain p-2" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="font-black text-black">₪{item.price}</span>
                  <span className="text-xs bg-black text-white px-3 py-1.5 rounded-lg font-medium">צפה במוצר</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* פופ-אפ מבצע */}
      {showPromoModal && promoProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">✓</div>
            <div>
              <h3 className="text-2xl font-black text-gray-900">המוצר נוסף לסל בהצלחה!</h3>
              <p className="text-gray-500 text-sm mt-1">בטוח תרצה להוסיף גם את זה:</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border flex items-center gap-4 text-right">
              <img src={promoProduct.image_url || promoProduct.image_urls?.[0]} alt="" className="w-20 h-20 object-contain bg-white rounded-xl border p-1" />
              <div>
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">מבצע בלעדי 🎁</span>
                <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1">{promoProduct.name}</h4>
                <div className="text-sm font-black text-black mt-1">₪{promoProduct.price} בלבד!</div>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={handleAddPromoToCart} className="w-full bg-black text-white py-3.5 rounded-xl font-bold">הוסף מבצע לסל 🚀</button>
              <button onClick={() => setShowPromoModal(false)} className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">המשך לקופה / סגור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
