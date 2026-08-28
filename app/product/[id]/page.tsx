'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ProductPage() {
  const params = useParams();
  const id = params?.id;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*');

        if (error) {
          console.error('Error fetching products:', error);
        } else if (data) {
          const found = data.find((p: any) => String(p.id) === String(id) || String(p._id) === String(id));
          setProduct(found || null);
          if (found) {
            const initialImg = (found.images && found.images.length > 0) ? found.images[0] : (found.image || '');
            setSelectedImage(initialImg);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="p-12 text-center text-gray-500">המוצר לא נמצא</div>;

  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product.image 
      ? [product.image] 
      : [];

  const currentImage = selectedImage || imagesList[0] || '';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8 bg-white rounded-2xl shadow-sm mt-6">
      {/* אזור התמונות והגלרייה */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <div className="w-full h-80 md:h-96 bg-gray-50 border rounded-2xl overflow-hidden flex items-center justify-center relative p-2">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt={product.name} 
              className="object-contain h-full w-full"
            />
          ) : (
            <span className="text-gray-400">אין תמונה זמינה</span>
          )}
        </div>

        {imagesList.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {imagesList.map((img: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                  currentImage === img ? 'border-black ring-2 ring-black/10' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* פרטי המוצר המלאים מהניהול */}
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>
        
        {/* תגיות מותג, כשרות, קטגוריה, נפח וגרסה */}
        <div className="flex flex-wrap gap-2">
          {product.brand && (
            <span className="bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-lg font-medium border border-orange-100">
              {product.brand}
            </span>
          )}
          {product.category && (
            <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-lg font-medium border border-gray-200">
              {product.category}
            </span>
          )}
          {product.kosher && (
            <span className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-lg font-medium border border-blue-100">
              {product.kosher}
            </span>
          )}
          {product.kosher_type && (
            <span className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-lg font-medium border border-blue-100">
              {product.kosher_type}
            </span>
          )}
          {product.certification && (
            <span className="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-lg font-medium border border-green-100">
              {product.certification}
            </span>
          )}
          {product.storage && (
            <span className="bg-purple-50 text-purple-700 text-sm px-3 py-1 rounded-lg font-medium border border-purple-100">
              נפח: {product.storage}
            </span>
          )}
          {product.ram && (
            <span className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-lg font-medium border border-indigo-100">
              RAM: {product.ram}
            </span>
          )}
          {product.version && (
            <span className="bg-pink-50 text-pink-700 text-sm px-3 py-1 rounded-lg font-medium border border-pink-100">
              גרסה: {product.version}
            </span>
          )}
        </div>

        <p className="text-2xl font-bold text-gray-900">₪{product.price}</p>
        
        <button 
          onClick={() => {
            alert('המוצר נוסף לסל בהצלחה!');
          }}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          הוספה לסל
        </button>

        {product.description && (
          <div className="border-t pt-4 mt-2">
            <h3 className="font-semibold text-gray-800 mb-2">תיאור המוצר:</h3>
            <p className="text-gray-600 text-sm md:text-base whitespace-pre-line leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
