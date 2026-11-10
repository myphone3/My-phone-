'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import Icon from '@/components/Icon';
import SmartFilters from '@/components/SmartFilters';
import { EMPTY_FACETS, FacetState, applyFacets } from '@/lib/facets';

// כל המוצרים בחנות: סינון לפי קטגוריה וכשרות, ומיון לפי מחיר

const priceOf = (p: any): number => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;

const SORTS = [
  { key: 'new', label: 'החדשים ביותר' },
  { key: 'low', label: 'מחיר: מהזול ליקר' },
  { key: 'high', label: 'מחיר: מהיקר לזול' },
  { key: 'sale', label: 'מבצעים קודם' },
];

function CatalogContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [products, setProducts] = useState<any[] | null>(null);
  const [facets, setFacets] = useState<FacetState>(EMPTY_FACETS);

  const category = params.get('category') || '';
  const sort = params.get('sort') || 'new';
  const q = params.get('q') || '';

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .or('is_published.is.null,is_published.eq.true')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProducts(data || []));
  }, []);

  // בהחלפת קטגוריה הסינונים מתאפסים: לכל קטגוריה יש סינונים משלה
  useEffect(() => setFacets(EMPTY_FACETS), [category]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/catalog${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const all = products || [];
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    all.forEach((p) => p.category && count.set(p.category, (count.get(p.category) || 0) + 1));
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]);
  }, [all]);
  // המוצרים של הקטגוריה (והחיפוש): מהם נבנים הסינונים
  const scope = useMemo(
    () => all.filter((p) => (!category || p.category === category) && (!q || String(p.name || '').toLowerCase().includes(q.toLowerCase()))),
    [all, category, q]
  );

  const list = useMemo(() => {
    let out = applyFacets(scope, facets);
    if (sort === 'low') out = [...out].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === 'high') out = [...out].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === 'sale') out = [...out].sort((a, b) => Number(!!(b.sale_price && Number(b.sale_price) < Number(b.price))) - Number(!!(a.sale_price && Number(a.sale_price) < Number(a.price))));
    return out;
  }, [scope, facets, sort]);

  const chip = (active: boolean) =>
    `shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border-2 transition cursor-pointer whitespace-nowrap ${
      active ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-700 border-orange-100 hover:border-orange-300'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-16 space-y-5" dir="rtl">
      <nav className="text-xs font-bold text-gray-500 flex gap-2">
        <Link href="/" className="hover:text-orange-600">דף הבית</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800">כל המוצרים</span>
      </nav>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">כל המוצרים</h1>
          <p className="text-sm text-gray-500 pr-4 mt-1">{products ? `${list.length} מוצרים${list.length !== all.length ? ` מתוך ${all.length}` : ''}` : 'טוען...'}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
          מיון:
          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value === 'new' ? '' : e.target.value)}
            className="bg-white border-2 border-orange-100 focus:border-orange-400 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-orange-50/60 border border-orange-200/80 rounded-3xl p-3 sm:p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button type="button" onClick={() => setParam('category', '')} className={chip(!category)}>
            הכל ({all.length})
          </button>
          {categories.map(([c, n]) => (
            <button key={c} type="button" onClick={() => setParam('category', c === category ? '' : c)} className={chip(category === c)}>
              {c} ({n})
            </button>
          ))}
        </div>
        {q && (
          <button type="button" onClick={() => setParam('q', '')} className="text-xs font-bold text-orange-700 inline-flex items-center gap-1 cursor-pointer">
            <Icon name="x" size={12} /> חיפוש: {q}
          </button>
        )}
      </div>

      {products && <SmartFilters products={scope} value={facets} onChange={setFacets} resultCount={list.length} />}

      {!products ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-orange-200 space-y-2">
          <p className="flex justify-center text-gray-300"><Icon name="search" size={40} /></p>
          <p className="font-black text-gray-900">לא נמצאו מוצרים</p>
          <button type="button" onClick={() => {
              setFacets(EMPTY_FACETS);
              router.replace('/catalog');
            }} className="text-xs font-bold text-orange-700 underline cursor-pointer">
            ניקוי הסינון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-bold text-sm text-gray-600">טוען את המוצרים...</div>}>
      <CatalogContent />
    </Suspense>
  );
}
