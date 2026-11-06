'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import ProductRow from './ProductRow';

// "צפיתם לאחרונה": המוצרים שהלקוח פתח, בסדר מהאחרון לראשון
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed().filter((id) => id !== excludeId);
    if (!ids.length) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .or('is_published.is.null,is_published.eq.true')
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byId = new Map(data.map((p: any) => [p.id, p]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
      });
    return () => {
      cancelled = true;
    };
  }, [excludeId]);

  return <ProductRow title="👀 צפיתם לאחרונה" products={products} />;
}
