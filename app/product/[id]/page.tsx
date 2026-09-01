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
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (data) {
      setProduct(data);
      setSelectedImage(data.image_url || data.images?.[0] || '');
      if (data.product_colors && data.product_colors.length > 0) {
        setSelectedColor(data.product_colors[0]);
        if (data.product_colors[0].image) {
          setSelectedImage(data.product_colors[0].image);
        }
      }
    }
    setLoading(false);
  };

  const addToCart = () => {
    if (!product) return;

    const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingIndex = existingCart.findIndex((item: any) => 
      item.id === product.id && item.selectedColor?.name === selectedColor?.name
    );

    const itemToAdd = {
      ...product,
      image_url: selectedImage || product.image_url,
      selectedColor: selectedColor || null,
      quantity: quantity
    };

    if (existingIndex > -1) {
      existingCart[existingIndex].quantity += quantity;
    } else {
      existingCart.push(itemToAdd);
    }

    localStorage.setItem('cart', JSON.stringify(existingCart));
    alert('המוצר נוסף לעגלה בהצלחה! 🛒');
  };

  if (loading) {
    return <div className="text-center py-20 font-bold text-sm text-gray-600">טוען מוצר...</div>;
  }

  if (!product) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-gray-500 font-medium">המוצר לא נמצא</p>
        <Link href="/" className="inline-block bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  const images = [product.image_url, ...(product.images || [])].filter(Boolean);
  const uniqueImages = Array.from(new Set(images));
  const colors = product.product_colors || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 px-4 py-2 rounded-xl w-fit">
        <Link href="/" className="hover:text-black transition">דף הבית</Link>
        <span>/</span>
        <span>{product.category || 'מוצרים'}</span>
        <span>/</span>
        <span className="text-black">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 sm:p-8 rounded-3xl border shadow-sm">
        {/* תמונות המוצר */}
        <div className="space-y-4">
          <div className="h-72 sm:h-96 w-full bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden relative">
            <img src={selectedImage} alt={product.name} className="w-full h-full object-contain p-4" />
            {product.sale_price && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow">
                מבצע ⚡
              </span>
            )}
          </div>
          {uniqueImages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {uniqueImages.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-xl border overflow-hidden shrink-0 transition cursor-pointer ${selectedImage === img ? 'border-orange-600 ring-2 ring-orange-600/20' : 'border-gray-200'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* פרטי המוצר וכפתורי רכישה */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{product.brand || product.category}</span>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">{product.name}</h1>
            </div>

            <div className="flex items-baseline gap-3">
              {product.sale_price ? (
                <>
                  <span className="text-2xl font-black text-red-600">₪{product.sale_price}</span>
                  <span className="text-sm text-gray-400 line-through">₪{product.price}</span>
                </>
              ) : (
                <span className="text-2xl font-black text-gray-900">₪{product.price}</span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{product.description || product.short_description}</p>

            {/* בחירת צבעים */}
            {colors.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-bold text-gray-700">בחר צבע: <span className="text-orange-600">{selectedColor?.name}</span></span>
                <div className="flex items-center gap-2">
                  {colors.map((col: any, idx: number) => {
                    const isSelected = selectedColor?.name === col.name;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedColor(col);
                          if (col.image) setSelectedImage(col.image);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 cursor-pointer ${
                          isSelected ? 'border-orange-600 bg-orange-50 text-orange-700 shadow-xs' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300" style={{ backgroundColor: col.hex || '#000' }}></span>
                        <span>{col.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* כפתור הוספה לעגלה */}
          <div className="space-y-3 pt-4 border-t">
            <button
              onClick={addToCart}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl text-sm font-black transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🛒 הוספה לעגלה</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
