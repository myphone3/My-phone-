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
        // שליפת כל המוצרים והשוואת ה-ID כדי למנוע בעיות התאמה (מחרוזת מול מספר)
        const { data, error } = await supabase
          .from('products')
          .select('*');

        if (error) {
          console.error('Error fetching products:', error);
        } else if (data) {
          const found = data.find((p: any) => String(p.id) === String(id) || String(p._id) === String(id));
          setProduct(found || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-gray-500">טוען פרטי מוצר...</div>;
  if (!product) return <div className="p-8 text-center text-gray-500">המוצר לא נמצא</div>;

  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : product.image 
      ? [product.image] 
      : [];

  const currentImage = selectedImage || imagesList[0] || '';

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <div className="w-full h-96 bg-white border rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
          <img 
            src={currentImage} 
            alt={product.name} 
            className="object-contain h-full w-full p-2"
          />
        </div>

        {imagesList.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {imagesList.map((img: string, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedImage(img)}
                className={`w-16 h-16 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${
                  currentImage === img ? 'border-black ring-1 ring-black' : 'border-gray-200 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-full md:w-1/2 flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="text-xl font-semibold text-gray-800">₪{product.price}</p>
        <p className="text-gray-600">{product.description}</p>
      </div>
    </div>
  );
}
