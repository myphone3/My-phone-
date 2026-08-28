'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; // <-- הוסף שורה זו כאן

export default function ProductClientView({ product, relatedProducts, promoProduct }: { product: any; relatedProducts: any[]; promoProduct: any }) {
  const images = product.image_urls?.length > 0 ? product.image_urls : (product.image_url ? [product.image_url] : []);
  const [selectedImage, setSelectedImage] = useState<string>(images[0] || '');
  
  const colorList = product.colors ? product.colors.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
  const versionList = product.versions ? product.versions.split(',').map((v: string) => v.trim()).filter(Boolean) : [];

  const [selectedColor, setSelectedColor] = useState(colorList[0] || '');
  const [selectedVersion, setSelectedVersion] = useState(versionList[0] || '');
  const [showPromoModal, setShowPromoModal] = useState(false);

  const handleAddToCart = async () => {
    try {
      const cartItem = {
        name: product.name,
        price: product.price,
        selectedColor,
        selectedVersion,
        quantity: 1
      };
      
      await supabaseCartOrder(cartItem);
    } catch (e) {}

    setShowPromoModal(true);
  };

  const supabaseCartOrder = async (cartItem: any) => {
    await supabase.from('orders').insert([{
      customer_name: 'לקוח מהחנות',
      customer_phone: '0500000000',
      customer_address: 'כתובת לקוח',
      items: [cartItem],
      total: product.price,
      status: 'בטיפול'
    }]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-2xl shadow-sm border">
        
        {/* גלריית תמונות */}
        <div className="space-y-4">
          <div className="w-full h-96 bg-gray-50 rounded-2xl overflow-hidden border flex items-center justify-center">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="w-full h-full object-contain p-2" />
            ) : (
              <span className="text-gray-400">אין תמונה זמינה</span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img: string, index: number) => (
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

          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <div className="text-3xl font-black text-black">₪{product.price}</div>

          {colorList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">בחר צבע: <span className="text-black">{selectedColor}</span></label>
              <div className="flex gap-2">
                {colorList.map((color: string) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${selectedColor === color ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {versionList.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">בחר גרסה / נפח: <span className="text-black">{selectedVersion}</span></label>
              <div className="flex gap-2">
                {versionList.map((version: string) => (
                  <button
                    key={version}
                    onClick={() => setSelectedVersion(version)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${selectedVersion === version ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-800 hover:bg-gray-100'}`}
                  >
                    {version}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.warranty && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>🛡️</span>
              <span>אחריות: {product.warranty}</span>
            </div>
          )}

          {product.short_description && (
            <p className="text-gray-600 text-base leading-relaxed">{product.short_description}</p>
          )}

          <div className="pt-4 border-t">
            <button 
              onClick={handleAddToCart}
              className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-md"
            >
              הוסף לסל 🛒
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {product.description && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">תיאור מלא</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed">{product.description}</div>
          </div>
        )}
        {product.specs && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">מפרט טכני</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-xl font-mono text-sm">{product.specs}</div>
          </div>
        )}
      </div>

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

      {showPromoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-2xl font-black text-gray-900">המוצר נוסף לסל בהצלחה!</h3>
              <p className="text-gray-500 text-sm mt-1">בטוח תרצה להוסיף גם את זה:</p>
            </div>

            {promoProduct ? (
              <div className="bg-gray-50 p-4 rounded-2xl border flex items-center gap-4 text-right">
                <img src={promoProduct.image_url || promoProduct.image_urls?.[0]} alt="" className="w-20 h-20 object-contain bg-white rounded-xl border p-1" />
                <div>
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">מבצע בלעדי 🎁</span>
                  <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1">{promoProduct.name}</h4>
                  <div className="text-sm font-black text-black mt-1">₪{promoProduct.price} בלבד!</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">אין מבצע מוגדר כרגע למוצר זה.</p>
            )}

            <div className="space-y-2">
              {promoProduct && (
                <button 
                  onClick={() => {
                    alert('המוצר נוסף לסל בהצלחה!');
                    setShowPromoModal(false);
                  }}
                  className="w-full bg-black text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-md"
                >
                  הוסף גם את המבצע לסל 🚀
                </button>
              )}
              <button 
                onClick={() => setShowPromoModal(false)}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-sm"
              >
                המשך לקופה / סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
