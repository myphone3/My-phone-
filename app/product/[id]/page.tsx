'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (productId) fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').eq('id', productId).single();
    if (data) {
      setProduct(data);
      setSelectedImage(data.image_url || data.images?.[0] || '');
      if (data.product_colors?.length > 0) setSelectedColor(data.product_colors[0]);
      if (data.product_variants?.length > 0) setSelectedVariant(data.product_variants[0]);
    }
    setLoading(false);
  };

  const handleAddToCart = (redirect = false) => {
    const colors = product.product_colors || [];
    if (colors.length > 0 && !selectedColor) {
      alert('נא לבחור צבע ממבחר הצבעים הזמינים');
      return false;
    }

    const variants = product.product_variants || [];
    if (variants.length > 0 && !selectedVariant) {
      alert('נא לבחור גרסה / נפח אחסון מבוקש');
      return false;
    }

    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const itemToAdd = {
      ...product,
      image_url: selectedImage || product.image_url,
      selectedColor: selectedColor || null,
      selectedVariant: selectedVariant || null,
      quantity
    };

    existingCart.push(itemToAdd);
    localStorage.setItem('cart', JSON.stringify(existingCart));

    if (redirect) {
      router.push('/cart');
    } else {
      alert('המוצר נוסף לעגלה בהצלחה! 🛒');
    }
    return true;
  };

  if (loading) return <div className="text-center py-20 font-bold text-sm text-gray-600">טוען מוצר...</div>;
  if (!product) return <div className="text-center py-20 font-medium">המוצר לא נמצא</div>;

  const colors = product.product_colors || [];
  const variants = product.product_variants || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border shadow-sm">
        <div className="h-80 w-full bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden">
          <img src={selectedImage} alt={product.name} className="w-full h-full object-contain p-4" />
        </div>

        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
            <span className="text-2xl font-black text-orange-600">₪{product.sale_price || product.price}</span>
            <p className="text-xs text-gray-600 leading-relaxed">{product.description}</p>

            {variants.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-bold text-gray-700">בחר גרסה / נפח אחסון <span className="text-red-500">*</span>: <span className="text-orange-600">{selectedVariant}</span></span>
                <div className="flex gap-2">
                  {variants.map((v: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${selectedVariant === v ? 'border-orange-600 bg-orange-600 text-white' : 'border-gray-200 bg-white'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colors.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-bold text-gray-700">בחר צבע <span className="text-red-500">*</span>: <span className="text-orange-600">{selectedColor?.name}</span></span>
                <div className="flex gap-2">
                  {colors.map((col: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedColor(col); if (col.image) setSelectedImage(col.image); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 cursor-pointer ${selectedColor?.name === col.name ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200'}`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: col.hex }}></span>
                      <span>{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <button onClick={() => handleAddToCart(false)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-xs font-black transition cursor-pointer shadow-sm">
              🛒 הוספה לעגלה
            </button>
            <button onClick={() => handleAddToCart(true)} className="w-full bg-black hover:bg-gray-800 text-white py-3.5 rounded-2xl text-xs font-black transition cursor-pointer shadow-sm">
              ⚡ קניה ישירה ומהירה לתשלום
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
