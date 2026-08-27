'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProductPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setProduct(data);
        // הגדרת תמונה ראשית כברירת מחדל
        const initialImg = data.image_urls?.[0] || data.image_url || '';
        setSelectedImage(initialImg);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20">טוען פרטי מוצר...</div>;
  if (!product) return <div className="text-center py-20">המוצר אינו נמצא.</div>;

  // איסוף כל התמונות הקיימות (מערך או תמונה בודדת)
  const images = product.image_urls?.length > 0 ? product.image_urls : (product.image_url ? [product.image_url] : []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-2xl shadow-sm border">
        
        {/* אזור גלריית התמונות */}
        <div className="space-y-4">
          <div className="w-full h-96 bg-gray-50 rounded-2xl overflow-hidden border flex items-center justify-center">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="w-full h-full object-contain p-2" />
            ) : (
              <span className="text-gray-400">אין תמונה זמינה</span>
            )}
          </div>

          {/* תמונות ממוזגות (גלריה) */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img: string, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(img)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition flex-shrink-0 ${selectedImage === img ? 'border-black' : 'border-transparent opacity-70 hover:opacity-100'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {product.category && (
              <span className="bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-semibold">
                📁 {product.category}
              </span>
            )}
            {product.brand && (
              <span className="bg-blue-50 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
                🏷️ {product.brand}
              </span>
            )}
            {product.kosher && (
              <span className="bg-green-50 text-green-800 text-xs px-3 py-1 rounded-full font-semibold border border-green-200">
                ⭐ כשרות: {product.kosher}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          
          <div className="text-3xl font-black text-black">
            ₪{product.price}
          </div>

          {product.short_description && (
            <p className="text-gray-600 text-base leading-relaxed">
              {product.short_description}
            </p>
          )}

          <div className="pt-4 border-t">
            <button className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-md">
              הוסף לסל 🛒
            </button>
          </div>
        </div>
      </div>

      {/* תיאור מלא ומפרט טכני */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {product.description && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">תיאור מלא</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed">
              {product.description}
            </div>
          </div>
        )}

        {product.specs && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-3">
            <h2 className="text-xl font-bold text-gray-900 border-b pb-2">מפרט טכני</h2>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed bg-gray-50 p-4 rounded-xl font-mono text-sm">
              {product.specs}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
