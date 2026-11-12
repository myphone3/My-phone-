'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RECENT_EVENT, clearRecent, getRecent } from '@/lib/recent';

const imageOf = (p: any) => {
  if (p?.image_url) return p.image_url;
  if (Array.isArray(p?.images)) return p.images[0] || '';
  try {
    const v = JSON.parse(p?.images || '[]');
    return Array.isArray(v) ? v[0] || '' : '';
  } catch {
    return '';
  }
};

// שורת "צפיתם לאחרונה": המוצרים האחרונים שהלקוח פתח (בלי המוצר שהוא נמצא בו עכשיו)
export default function RecentlyViewed({ excludeId, className = '' }: { excludeId?: string; className?: string }) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const ids = getRecent().filter((id) => id !== String(excludeId ?? ''));
      if (!ids.length) return alive && setItems([]);
      const { data } = await supabase
        .from('products')
        .select('id, name, price, sale_price, image_url, images, is_published')
        .in('id', ids);
      if (!alive) return;
      const list = ids
        .map((id) => (data || []).find((p: any) => String(p.id) === id))
        .filter((p: any) => p && p.is_published !== false);
      setItems(list);
    };
    load();
    window.addEventListener(RECENT_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(RECENT_EVENT, load);
    };
  }, [excludeId]);

  if (!items.length) return null;

  return (
    <section className={`space-y-3 ${className}`} dir="rtl" aria-label="צפיתם לאחרונה">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-black text-gray-900 border-r-4 border-orange-600 pr-3">צפיתם לאחרונה</h2>
        <button type="button" onClick={clearRecent} className="text-[11px] font-bold text-gray-400 hover:text-gray-700 cursor-pointer">
          ניקוי
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x no-scrollbar">
        {items.map((p) => {
          const onSale = p.sale_price && Number(p.sale_price) < Number(p.price);
          const img = imageOf(p);
          return (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="snap-start shrink-0 w-32 sm:w-36 bg-white rounded-2xl border-2 border-orange-100 hover:border-orange-300 p-2 transition group"
            >
              <span className="block h-24 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center p-1.5">
                {img && <img src={img} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain group-hover:scale-105 transition" />}
              </span>
              <span className="mt-2 text-[11px] font-bold text-gray-900 leading-snug line-clamp-2 min-h-[2.4em]" dir="auto">
                {p.name}
              </span>
              <span className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-black text-orange-600">₪{onSale ? p.sale_price : p.price}</span>
                {onSale && <span className="text-[10px] text-gray-400 line-through">₪{p.price}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
