'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  COMPARE_EVENT,
  COMPARE_MAX,
  FAV_EVENT,
  deliveryEstimate,
  getBestSellers,
  getCompare,
  getFavorites as getFavoritesList,
  inCompare,
  isFavorite,
  productBadges,
  toggleCompare,
  toggleFavorite,
} from '@/lib/shop';
import { showToast } from '@/lib/toast';

// רכיבים קטנים שמופיעים על כרטיסי מוצר ובעמוד המוצר

function useStored<T>(event: string, read: () => T, initial: T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const update = () => setValue(read());
    update();
    window.addEventListener(event, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(event, update);
      window.removeEventListener('storage', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return value;
}

export function FavoriteButton({ productId, className = '', size = 'sm' }: { productId: string; className?: string; size?: 'sm' | 'lg' }) {
  const fav = useStored(FAV_EVENT, () => isFavorite(productId), false);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleFavorite(productId);
    showToast(added ? 'נשמר במועדפים ❤️' : 'הוסר מהמועדפים', added ? { kind: 'success', action: { href: '/favorites', label: 'למועדפים' } } : {});
  };
  const dim = size === 'lg' ? 'w-11 h-11 text-xl' : 'w-8 h-8 text-base';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={fav}
      aria-label={fav ? 'הסרה מהמועדפים' : 'שמירה במועדפים'}
      title={fav ? 'הסרה מהמועדפים' : 'שמירה במועדפים'}
      className={`${dim} rounded-full bg-white/95 border border-gray-200 shadow-sm flex items-center justify-center cursor-pointer hover:scale-110 transition ${className}`}
    >
      <span className={fav ? 'text-red-500' : 'text-gray-400'}>{fav ? '♥' : '♡'}</span>
    </button>
  );
}

export function CompareButton({ productId, variant = 'chip' }: { productId: string; variant?: 'chip' | 'full' }) {
  const active = useStored(COMPARE_EVENT, () => inCompare(productId), false);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(productId);
    if (result === 'full') showToast(`אפשר להשוות עד ${COMPARE_MAX} מוצרים`, { kind: 'error', action: { href: '/compare', label: 'להשוואה' } });
    else if (result === 'added') showToast('נוסף להשוואה ⚖️', { kind: 'success', action: { href: '/compare', label: 'להשוואה' } });
  };
  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`flex-1 py-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
          active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
      >
        ⚖️ {active ? 'בהשוואה ✓' : 'הוספה להשוואה'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="השוואת מוצרים"
      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
      }`}
    >
      ⚖️ {active ? 'בהשוואה' : 'השוואה'}
    </button>
  );
}

export function ProductBadges({ product, className = '' }: { product: any; className?: string }) {
  const [best, setBest] = useState<Set<string> | undefined>();
  useEffect(() => {
    let alive = true;
    getBestSellers().then((s) => alive && setBest(s));
    return () => {
      alive = false;
    };
  }, []);
  const badges = productBadges(product, best);
  if (!badges.length) return null;
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {badges.map((b) => (
        <span key={b.label} className={`text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm whitespace-nowrap ${b.className}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function DeliveryEstimate({ compact = false }: { compact?: boolean }) {
  const [est, setEst] = useState<ReturnType<typeof deliveryEstimate> | null>(null);
  useEffect(() => {
    setEst(deliveryEstimate());
    const t = setInterval(() => setEst(deliveryEstimate()), 60000);
    return () => clearInterval(t);
  }, []);
  if (!est) return null;
  return (
    <div className={`flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-2xl ${compact ? 'p-2.5' : 'p-3'}`}>
      <span className="text-xl leading-none">🚚</span>
      <div className="text-xs leading-relaxed">
        <span className="block font-black text-green-900">
          יגיע אליך בין {est.fromText} ל{est.toText}
        </span>
        <span className="block text-green-800/80">
          {est.cutoffLeft ? `מזמינים בתוך ${est.cutoffLeft} וההזמנה יוצאת לטיפול עוד היום` : 'משלוח עד הבית · השליח מתקשר לפני ההגעה'}
        </span>
      </div>
    </div>
  );
}

// פס צף: כמה מוצרים בהשוואה, עם מעבר לעמוד ההשוואה
export function CompareBar() {
  const pathname = usePathname();
  const ids = useStored(COMPARE_EVENT, getCompare, [] as string[]);
  if (!ids.length || pathname === '/compare' || pathname?.startsWith('/admin') || pathname === '/cart') return null;
  return (
    <Link
      href="/compare"
      className="fixed bottom-5 right-5 z-40 bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3 text-xs font-black flex items-center gap-2 hover:bg-black transition"
      dir="rtl"
    >
      <span>⚖️</span>
      <span>השוואת {ids.length} מוצרים</span>
      <span className="text-orange-400">←</span>
    </Link>
  );
}

// שכבה על תמונת כרטיס מוצר: תגיות, לב למועדפים וכפתור השוואה
export function CardOverlay({ product }: { product: any }) {
  if (!product?.id) return null;
  return (
    <>
      <ProductBadges product={product} className="absolute bottom-2 right-2 z-10 pointer-events-none" />
      <div className="absolute bottom-2 left-2 z-10 flex flex-col items-end gap-1">
        <FavoriteButton productId={String(product.id)} />
        <CompareButton productId={String(product.id)} />
      </div>
    </>
  );
}

// לב בכותרת האתר עם מספר המועדפים
export function FavoritesLink() {
  const ids = useStored(FAV_EVENT, getFavoritesList, [] as string[]);
  return (
    <Link
      href="/favorites"
      className="relative p-2 bg-white hover:bg-red-50 border-2 border-orange-200 text-red-500 rounded-xl transition shadow-2xs flex items-center justify-center font-bold"
      title="המועדפים שלי"
      aria-label={`המועדפים שלי${ids.length ? ` (${ids.length})` : ''}`}
    >
      <span className="text-lg leading-none">{ids.length ? '♥' : '♡'}</span>
      {ids.length > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center font-black border-2 border-white shadow-md">
          {ids.length}
        </span>
      )}
    </Link>
  );
}
