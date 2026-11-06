'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { showAddedToCart, showToast } from '@/lib/toast';
import { COMPARE_EVENT, COMPARE_MAX, getCompare, toggleCompare } from '@/lib/compare';
import { versionExtra as getVersionExtra } from '@/lib/versionPrice';

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
  // תוספת המחיר של הגרסה היחידה, אם יש, כדי שהמחיר בכרטיס יהיה המחיר שנכנס לעגלה
  const versionExtra = versions.length === 1 ? getVersionExtra(product, versions[0]) : 0;
  const price = (Number(onSale ? product.sale_price : product.price) || 0) + versionExtra;
  const regularPrice = (Number(product.price) || 0) + versionExtra;
  // מוצר עם כמה צבעים או גרסאות: הלקוח בוחר בעמוד המוצר
  const needsChoice = colors.length > 1 || versions.length > 1;

  const [inCompare, setInCompare] = useState(false);
  useEffect(() => {
    const update = () => setInCompare(getCompare().includes(product.id));
    update();
    window.addEventListener(COMPARE_EVENT, update);
    return () => window.removeEventListener(COMPARE_EVENT, update);
  }, [product.id]);

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!toggleCompare(product.id)) {
      showToast(`אפשר להשוות עד ${COMPARE_MAX} מכשירים. הסירו אחד ונסו שוב.`, { kind: 'error' });
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const color = colors[0] ? (typeof colors[0] === 'object' ? colors[0].name : colors[0]) || '' : '';
      const version = versions[0] ? (typeof versions[0] === 'object' ? versions[0].name : versions[0]) || '' : '';
      const id = `${product.id}-${color}-${version}`;

      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const existing = cart.find((item: any) => item.id === id);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 1) + 1;
      } else {
        cart.push({ id, productId: product.id, name: product.name, price, image, color, version, quantity: 1 });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      showAddedToCart();
    } catch (err) {
      console.error('Add to cart error:', err);
    }
  };

  return (
    <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between group" dir="rtl">
      <Link href={`/product/${product.id}`} className="block">
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
            {onSale && <span className="text-xs text-gray-400 line-through">₪{regularPrice}</span>}
          </div>
        </div>
      </Link>

      <div className="mt-2 space-y-1.5">
        {needsChoice ? (
          <Link
            href={`/product/${product.id}`}
            className="block w-full text-center bg-orange-50 text-orange-600 border border-orange-200 py-2 rounded-xl text-xs font-black"
          >
            לבחירת צבע וגרסה
          </Link>
        ) : (
          <button
            onClick={handleAddToCart}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl text-xs font-black transition cursor-pointer"
          >
            הוספה לעגלה 🛒
          </button>
        )}
        <button
          type="button"
          onClick={handleCompare}
          aria-pressed={inCompare}
          className={`w-full py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
            inCompare ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-700'
          }`}
        >
          {inCompare ? '✓ בהשוואה' : '⚖️ השוואה'}
        </button>
      </div>
    </div>
  );
}
