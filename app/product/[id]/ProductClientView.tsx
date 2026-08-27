'use client';

import React, { useState } from 'react';

export default function ProductClientView({ product }: { product: any }) {
  const images = product.image_urls?.length > 0 ? product.image_urls : (product.image_url ? [product.image_url] : []);
  const [selectedImage, setSelectedImage] = useState<string>(images[0] || '');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
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

        {/* פרטי המוצר ותגיות עם תמונות */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {product.category && (
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full border">
                {product.categoryImage ? (
                  <img src={product.categoryImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span>📁</span>
                )}
                <span className="text-xs font-semibold text-gray-800">{product.category}</span>
              </div>
            )}
            {product.brand && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                {product.brandImage ? (
                  <img src={product.brandImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span>🏷️</span>
                )}
                <span className="text-xs font-semibold text-blue-800">{product.brand}</span>
              </div>
            )}
            {product.kosher && (
              <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                {product.kosherImage ? (
                  <img src={product.kosherImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span>⭐</span>
                )}
                <span className="text-xs font-semibold text-green-800">כשרות: {product.kosher}</span>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <div className="text-3xl font-black text-black">₪{product.price}</div>

          {product.short_description && (
            <p className="text-gray-600 text-base leading-relaxed">{product.short_description}</p>
          )}

          <div className="pt-4 border-t">
            <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-md">
              הוסף לסל 🛒
            </button>
          </div>
        </div>
      </div>

      {/* תיאור ומפרט */}
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
    </div>
  );
}
