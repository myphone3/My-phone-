'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ProductCard({ product }: { product: any }) {
  // הגדרת תמונה ראשית ותמונה שנייה בריחוף
  const primaryImg = product.images?.[0] || product.image_url || 'https://via.placeholder.com/300';
  const secondaryImg = product.images?.[1] || primaryImg;
  
  const [currentImage, setCurrentImage] = useState(primaryImg);

  return (
    <Link href={`/products/${product.id}`} className="block">
      <div className="bg-white rounded-3xl border p-4 shadow-sm flex flex-col hover:shadow-md transition">
        {/* אזור התמונה - מתחלף לתמונה השנייה בריחוף */}
        <div 
          className="relative overflow-hidden rounded-2xl bg-gray-50 h-52 flex items-center justify-center"
          onMouseEnter={() => setCurrentImage(secondaryImg)}
          onMouseLeave={() => setCurrentImage(primaryImg)}
        >
          <img src={currentImage} alt={product.name} className="w-full h-full object-contain transition duration-300" />
        </div>

        <h3 className="font-bold text-sm text-gray-900 mt-3">{product.name}</h3>
        <span className="font-black text-black text-sm mt-1">₪{product.price}</span>

        {/* כפתורי צבעים בקטלוג - לחיצה עליהם משנה את התמונה המוצגת */}
        {product.product_colors && product.product_colors.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3" onClick={(e) => e.preventDefault()}>
            {product.product_colors.map((color: any, idx: number) => (
              <button
                key={idx}
                title={color.name}
                onClick={() => {
                  if (color.image) setCurrentImage(color.image);
                }}
                style={{ backgroundColor: color.hex }}
                className="w-5 h-5 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition cursor-pointer"
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
