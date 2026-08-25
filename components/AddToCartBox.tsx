'use client';

import { useState } from 'react';
import { Product } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';

export default function AddToCartBox({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const inStock = product.stock > 0;

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (!inStock) {
    return (
      <div className="bg-line text-muted rounded-card py-3 text-center font-medium">
        אזל מהמלאי
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border border-line rounded-card overflow-hidden">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-10 h-11 hover:bg-paper transition-colors"
          aria-label="הפחת כמות"
        >
          −
        </button>
        <span className="w-10 text-center spec-num">{qty}</span>
        <button
          onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
          className="w-10 h-11 hover:bg-paper transition-colors"
          aria-label="הוסף כמות"
        >
          +
        </button>
      </div>
      <button
        onClick={handleAdd}
        className="flex-1 bg-ink text-white font-medium rounded-card py-3 hover:bg-accent transition-colors"
      >
        {added ? 'נוסף לעגלה ✓' : 'הוסף לעגלה'}
      </button>
    </div>
  );
}
