'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProductRow from './ProductRow';

// "לקוחות שקנו את זה קנו גם": לפי הזמנות אמיתיות. בלי מספיק נתונים - מוצרים מאותה קטגוריה.
export default function AlsoBought({ product }: { product: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [fromOrders, setFromOrders] = useState(true);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    (async () => {
      const { data: pairs } = await supabase.rpc('also_bought', { p_product_id: product.id, p_limit: 6 });
      const ids: string[] = (pairs || []).map((r: any) => r.product_id);
      let list: any[] = [];
      if (ids.length) {
        const { data } = await supabase.from('products').select('*').in('id', ids);
        const byId = new Map((data || []).map((p: any) => [p.id, p]));
        list = ids.map((id) => byId.get(id)).filter(Boolean);
      }
      let usedOrders = true;
      if (list.length < 2 && product.category) {
        usedOrders = list.length > 0;
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('category', product.category)
          .neq('id', product.id)
          .or('is_published.is.null,is_published.eq.true')
          .limit(8);
        const seen = new Set(list.map((p) => p.id));
        list = [...list, ...(data || []).filter((p: any) => !seen.has(p.id))].slice(0, 6);
      }
      if (!cancelled) {
        setProducts(list);
        setFromOrders(usedOrders);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category]);

  return <ProductRow title={fromOrders ? '🤝 לקוחות שקנו את זה קנו גם' : '✨ עוד מוצרים שכדאי לראות'} products={products} />;
}
