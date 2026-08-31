'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ProductClientView({ product }: { product: any }) {
  const images = product.images && product.images.length > 0 ? product.images : [product.image_url].filter(Boolean);
  const mainIdx = product.main_image_index || 0;
  
  const [activeImage, setActiveImage] = useState<string>(images[mainIdx] || images[0] || '');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedStorage, setSelectedStorage] = useState<string>(product.storage || '');
  const [quantity, setQuantity] = useState<number>(1);

  const versions = product.product_versions || [];
  const colors = product.product_colors || [];

  const handleColorSelect = (col: any) => {
    const colName = typeof col === 'string' ? col : col.name;
    setSelectedColor(colName);
    if (typeof col === 'object' && col.image) {
      setActiveImage(col.image);
    }
  };

  const addToCart = () => {
    if (versions.length > 0 && !selectedVersion) {
      alert('נא לבחור גרסה לפני הוספה לסל.');
      return;
    }

    if (colors.length > 0 && !selectedColor) {
      alert('נא לבחור צבע לפני הוספה לסל.');
      return;
    }

    if (product.storage && !selectedStorage) {
      alert('נא לבחור נפח אחסון לפני הוספה לסל.');
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const cartItem = {
        ...product,
        image_url: activeImage || product.image_url,
        selectedVersion: selectedVersion || product.version || '',
        selectedColor: selectedColor || '',
        selectedStorage: selectedStorage || product.storage || '',
        cartId: `${product.id}-${selectedVersion || ''}-${selectedColor || ''}-${selectedStorage || ''}`
      };

      const existingIndex = cart.findIndex((item: any) => item.cartId === cartItem.cartId);
      if (existingIndex > -1) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + quantity;
      } else {
        cart.push({ ...cartItem, quantity: quantity });
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      alert('המוצר נוסף לעגלה בהצלחה! 🛒');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <Link href="/" className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition">
        ← חזרה לחנות
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-10 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* תמונות */}
        <div className="space-y-4">
          <div className="h-80 sm:h-96 w-full bg-gray-50 rounded-2xl border overflow-hidden flex items-center justify-center p-4">
            <img src={activeImage || product.image_url} alt={product.name} className="max-h-full max-w-full object-contain" />
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-20 h-20 rounded-xl border-2 overflow-hidden bg-gray-50 shrink-0 p-1 ${activeImage === img ? 'border-black' : 'border-transparent'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטים ובחירות */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {product.brand && <span className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-lg">מותג: {product.brand}</span>}
              {product.category && <span className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-lg">קטגוריה: {product.category}</span>}
              {product.kosher && <span className="bg-amber-50 text-amber-800 text-xs font-bold px-3 py-1 rounded-lg">כשרות: {product.kosher}</span>}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{product.name}</h1>
            <div className="text-2xl font-black text-gray-900">₪{product.price}</div>

            <p className="text-sm text-gray-600 leading-relaxed">{product.description || product.short_description}</p>

            {/* בחירת גרסה */}
            {versions.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-gray-800">בחר גרסה: <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {versions.map((ver: string) => (
                    <button
                      key={ver}
                      type="button"
                      onClick={() => setSelectedVersion(ver)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                        selectedVersion === ver
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-black'
                      }`}
                    >
                      {ver}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* בחירת צבע */}
            {colors.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-gray-800">בחר צבע: <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((col: any) => {
                    const colName = typeof col === 'string' ? col : col.name;
                    const colHex = typeof col === 'object' ? col.hex : '';
                    const isSelected = selectedColor === colName;

                    return (
                      <button
                        key={colName}
                        type="button"
                        onClick={() => handleColorSelect(col)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border flex items-center gap-2 ${
                          isSelected ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-black'
                        }`}
                      >
                        {colHex && <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: colHex }}></span>}
                        {colName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* נפח אחסון */}
            {product.storage && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-gray-800">נפח אחסון:</label>
                <div className="inline-block px-4 py-2 rounded-xl text-xs font-bold border bg-gray-50 border-gray-200 text-gray-800">
                  {product.storage}
                </div>
              </div>
            )}

            {(product.specs || product.warranty) && (
              <div className="bg-gray-50 p-4 rounded-2xl border space-y-2 text-xs">
                {product.specs && <div><span className="font-bold">מפרט טכני:</span> {product.specs}</div>}
                {product.warranty && <div><span className="font-bold">אחריות:</span> {product.warranty}</div>}
              </div>
            )}
          </div>

          <div className="pt-6 border-t space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-xl overflow-hidden bg-gray-50">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-700 font-bold hover:bg-gray-200 transition">-</button>
                <span className="px-4 text-xs font-bold">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-gray-700 font-bold hover:bg-gray-200 transition">+</button>
              </div>

              <button onClick={addToCart} className="flex-1 bg-black text-white py-3.5 rounded-2xl text-sm font-bold hover:bg-gray-800 transition shadow-sm cursor-pointer">
                הוסף לעגלה 🛒
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
