'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import ProductCard from './ProductCard';

const published = 'is_published.is.null,is_published.eq.true';

async function fetchByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase.from('products').select('*').in('id', ids).or(published);
  const byId = new Map((data || []).map((p: any) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as any[];
}

// בלוק אחד מסודר בתחתית דף המוצר, עם שתי לשוניות:
// "מומלצים בשבילך" (מוצרים שנבחרו בניהול + מה שלקוחות קנו יחד + מאותה קטגוריה) ו"צפיתם לאחרונה"
export default function ProductSuggestions({ product, related = [] }: { product: any; related?: any[] }) {
  const [recommended, setRecommended] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [tab, setTab] = useState<'rec' | 'recent'>('rec');

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    (async () => {
      const { data: pairs } = await supabase.rpc('also_bought', { p_product_id: product.id, p_limit: 6 });
      const boughtIds: string[] = (pairs || []).map((r: any) => r.product_id);
      const seen = new Set<string>([product.id]);
      const list: any[] = [];
      const add = (items: any[]) => {
        for (const p of items) {
          if (p && !seen.has(p.id) && list.length < 8) {
            seen.add(p.id);
            list.push(p);
          }
        }
      };
      add(related);
      add(await fetchByIds(boughtIds));
      if (list.length < 4 && product.category) {
        const { data } = await supabase.from('products').select('*').eq('category', product.category).or(published).limit(10);
        add(data || []);
      }
      const recentList = await fetchByIds(getRecentlyViewed().filter((id) => id !== product.id));
      if (!cancelled) {
        setRecommended(list);
        setRecent(recentList);
        if (!list.length && recentList.length) setTab('recent');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.category, related]);

  if (!recommended.length && !recent.length) return null;
  const shown = tab === 'rec' ? recommended : recent;

  const Tab = ({ id, label, count }: { id: 'rec' | 'recent'; label: string; count: number }) =>
    count ? (
      <button
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => setTab(id)}
        className={`px-4 py-2 rounded-full text-xs font-black transition cursor-pointer ${
          tab === id ? 'bg-orange-600 text-white shadow-sm' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
        }`}
      >
        {label}
      </button>
    ) : null;

  return (
    <section className="bg-white p-4 sm:p-6 rounded-3xl border-2 border-orange-100 shadow-sm space-y-4" aria-label="מוצרים נוספים">
      <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
        <Tab id="rec" label="✨ מומלצים בשבילך" count={recommended.length} />
        <Tab id="recent" label="👀 צפיתם לאחרונה" count={recent.length} />
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x" role="tabpanel">
        {shown.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-40 sm:w-44">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
