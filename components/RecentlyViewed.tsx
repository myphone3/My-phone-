'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import ProductCard from './ProductCard';

// "צפיתם לאחרונה" בדף הבית: מופיע רק למי שכבר צפה במוצרים
export default function RecentlyViewed() {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed();
    if (!ids.length) return;
    supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .or('is_published.is.null,is_published.eq.true')
      .then(({ data }) => {
        const byId = new Map((data || []).map((p: any) => [p.id, p]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 8));
      });
  }, []);

  if (!products.length) return null;
  return (
    <section className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-orange-100 shadow-sm space-y-3" aria-label="צפיתם לאחרונה">
      <h2 className="text-sm sm:text-base font-black text-gray-900">👀 צפיתם לאחרונה</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 snap-x">
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-36 sm:w-44">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
