'use client';

import React from 'react';
import Link from 'next/link';
import { showAddedToCart } from '@/lib/toast';

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export default function ProductCard({ product }: { product: any }) {
  const images = asArray(product.images);
  const image = product.image_url || images[0] || '';
  const colors = asArray(product.product_colors || product.colors);
  const versions = asArray(product.product_variants || product.versions || product.product_versions || product.variants);
  const onSale = product.sale_price && Number(product.sale_price) < Number(product.price);
  const price = Number(onSale ? product.sale_price : product.price) || 0;
  // מוצר עם כמה צבעים או גרסאות: הלקוח בוחר בעמוד המוצר
  const needsChoice = colors.length > 1 || versions.length > 1;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const color = colors[0] ? (typeof colors[0] === 'object' ? colors[0].name : colors[0]) || '' : '';
      const version = versions[0] ? (typeof versions[0] === 'object' ? versions[0].name : versions[0]) || '' : '';
      const versionExtra = typeof versions[0] === 'object' ? Number(versions[0].price_add || versions[0].price || 0) : 0;
      const id = `${product.id}-${color}-${version}`;

      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const existing = cart.find((item: any) => item.id === id);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 1) + 1;
      } else {
        cart.push({ id, productId: product.id, name: product.name, price: price + versionExtra, image, color, version, quantity: 1 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      showAddedToCart();
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  return (
    <Link
      href={`/product/${product.id}`}
      className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
      dir="rtl"
    >
      <div className="h-40 w-full bg-gray-50 rounded-xl flex items-center justify-center p-2 relative overflow-hidden">
        {onSale && (
          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-lg z-10">
            מבצע 🔥
          </span>
        )}
        {image ? (
          <img src={image} alt={product.name} className="h-full object-contain group-hover:scale-105 transition" />
        ) : (
          <span className="text-xs text-gray-400">אין תמונה</span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <h3 className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition line-clamp-2" dir="auto">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-black text-orange-600">₪{price}</span>
          {onSale && <span className="text-xs text-gray-400 line-through">₪{product.price}</span>}
        </div>
        {needsChoice ? (
          <span className="block w-full text-center bg-orange-50 text-orange-600 border border-orange-200 py-2 rounded-xl text-xs font-black">
            לבחירת צבע וגרסה
          </span>
        ) : (
          <button
            onClick={handleAddToCart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl text-xs font-black transition cursor-pointer"
          >
            הוספה לעגלה 🛒
          </button>
        )}
      </div>
    </Link>
  );
}
