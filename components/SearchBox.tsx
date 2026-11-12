'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { searchProducts } from '@/lib/search';
import { track } from '@/lib/track';

// תיבת החיפוש בראש האתר: הצעות עם תמונה ומחיר כבר בזמן ההקלדה
type Item = { id: string | number; name: string; brand?: string; category?: string; kosher?: string; short_description?: string; price?: number; sale_price?: number; image_url?: string; images?: any };

let productsPromise: Promise<Item[]> | null = null;
function loadProducts() {
  if (!productsPromise) {
    productsPromise = Promise.resolve(
      supabase
        .from('products')
        .select('id, name, brand, category, kosher, short_description, price, sale_price, image_url, images')
        .or('is_published.is.null,is_published.eq.true')
    ).then(({ data }) => (data as Item[]) || [], () => []);
    productsPromise.then((list) => {
      if (!list.length) productsPromise = null; // נכשל: ננסה שוב בפעם הבאה
    });
  }
  return productsPromise;
}

const imageOf = (p: Item) => {
  if (p.image_url) return p.image_url;
  if (Array.isArray(p.images)) return p.images[0] || '';
  try {
    const v = JSON.parse(p.images || '[]');
    return Array.isArray(v) ? v[0] || '' : '';
  } catch {
    return '';
  }
};

const priceOf = (p: Item) => (p.sale_price && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price) || 0);

export default function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Item[]>([]);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const warm = () => {
    loadProducts().then(setProducts);
  };

  const results = useMemo(() => (q.trim() ? searchProducts(products, q, 6) : []), [products, q]);

  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  const pick = (p: Item) => {
    track('search', { query: q.trim().slice(0, 100), results: results.length });
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const showList = open && q.trim().length > 0;

  return (
    <form
      ref={boxRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (active >= 0 && results[active]) {
          pick(results[active]);
          router.push(`/product/${results[active].id}`);
        } else go(q);
      }}
      className="relative flex-1 min-w-0"
    >
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => {
          warm();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder="חיפוש מוצרים, מכשירים, נגנים..."
        aria-label="חיפוש מוצרים"
        aria-expanded={showList}
        aria-controls="search-suggestions"
        aria-autocomplete="list"
        role="combobox"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        className="w-full bg-white border-2 border-orange-200 hover:border-orange-300 focus:border-orange-500 rounded-2xl py-2.5 pr-4 pl-10 text-xs font-medium text-gray-800 shadow-2xs outline-none transition"
      />
      <button type="submit" aria-label="חיפוש" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600 transition cursor-pointer">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      {showList && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute top-full mt-1.5 inset-x-0 z-50 bg-white rounded-2xl border-2 border-orange-100 shadow-xl overflow-hidden animate-in fade-in duration-150"
        >
          {!products.length ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl skeleton" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-3 w-3/4 rounded skeleton" />
                    <span className="block h-3 w-1/4 rounded skeleton" />
                  </span>
                </div>
              ))}
            </div>
          ) : results.length ? (
            <>
              {results.map((p, i) => {
                const img = imageOf(p);
                const onSale = p.sale_price && Number(p.sale_price) < Number(p.price);
                return (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => pick(p)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center gap-3 px-3 py-2 transition ${i === active ? 'bg-orange-50' : 'hover:bg-orange-50/60'}`}
                  >
                    <span className="w-11 h-11 shrink-0 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden p-0.5">
                      {img && <img src={img} alt="" className="max-w-full max-h-full object-contain" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-gray-900 truncate" dir="auto">{p.name}</span>
                      {(p.brand || p.category) && <span className="block text-[10px] text-gray-400 truncate">{[p.brand, p.category].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <span className="shrink-0 text-left">
                      <span className="block text-xs font-black text-orange-600">₪{priceOf(p)}</span>
                      {onSale && <span className="block text-[10px] text-gray-400 line-through">₪{p.price}</span>}
                    </span>
                  </Link>
                );
              })}
              <button
                type="submit"
                className="w-full text-center text-xs font-black text-orange-700 bg-orange-50/70 hover:bg-orange-100 py-2.5 border-t border-orange-100 cursor-pointer"
              >
                לכל התוצאות של &quot;{q.trim()}&quot; ←
              </button>
            </>
          ) : (
            <div className="p-4 text-center space-y-1">
              <p className="text-xs font-bold text-gray-700">לא מצאנו מוצר כזה</p>
              <p className="text-[11px] text-gray-500">
                נסו מילה אחרת, או{' '}
                <Link href="/quiz" onClick={() => setOpen(false)} className="text-orange-700 font-black underline underline-offset-2">
                  ענו על כמה שאלות ונמצא לכם מכשיר
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
