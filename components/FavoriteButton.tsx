'use client';

import { useEffect, useState } from 'react';
import { FAVORITES_EVENT, getFavorites, toggleFavorite } from '@/lib/favorites';
import { showToast } from '@/lib/toast';

// לב קטן: הוספה/הסרה מהמועדפים
export default function FavoriteButton({ productId, variant = 'icon' }: { productId: string; variant?: 'icon' | 'pill' }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const update = () => setOn(getFavorites().includes(productId));
    update();
    window.addEventListener(FAVORITES_EVENT, update);
    return () => window.removeEventListener(FAVORITES_EVENT, update);
  }, [productId]);

  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleFavorite(productId);
    if (added) showToast('נשמר במועדפים ❤️', { kind: 'success', action: { href: '/favorites', label: 'למועדפים' } });
  };

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={click}
        aria-pressed={on}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
          on ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-200 text-gray-700 hover:border-rose-200'
        }`}
      >
        <span>{on ? '❤️' : '🤍'}</span>
        <span>{on ? 'במועדפים' : 'למועדפים'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? 'הסרה מהמועדפים' : 'הוספה למועדפים'}
      className="absolute top-1.5 right-1.5 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition"
    >
      {on ? '❤️' : '🤍'}
    </button>
  );
}
