'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';
import { FAV_EVENT, getFavorites } from '@/lib/shop';

// המוצרים שהלקוח שמר ❤️ (נשמרים בדפדפן שלו)
export default function FavoritesPage() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const update = () => setIds(getFavorites());
    update();
    window.addEventListener(FAV_EVENT, update);
    return () => window.removeEventListener(FAV_EVENT, update);
  }, []);

  useEffect(() => {
    if (!ids) return;
    if (!ids.length) {
      setProducts([]);
      return;
    }
    supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .or('is_published.is.null,is_published.eq.true')
      .then(({ data }) => {
        const byId = new Map((data || []).map((p: any) => [String(p.id), p]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
      });
  }, [ids]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3">❤️ המועדפים שלי</h1>
          <p className="text-xs text-gray-500 mt-1 pr-4">המוצרים שסימנתם נשמרים כאן גם כשתחזרו לאתר</p>
        </div>
        {products.length > 1 && (
          <Link href="/compare" className="text-xs font-black text-orange-700 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl shrink-0">
            ⚖️ להשוואה
          </Link>
        )}
      </div>

      {ids === null ? (
        <p className="text-center py-20 text-gray-500">טוען...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <div className="text-5xl">♡</div>
          <p className="font-black text-gray-900">עדיין לא שמרתם מוצרים</p>
          <p className="text-sm text-gray-500">לחצו על הלב ♡ בכרטיס של מוצר כדי לשמור אותו לפעם הבאה</p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/" className="bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-black">לחנות</Link>
            <Link href="/quiz" className="bg-white border border-orange-200 text-orange-700 px-5 py-2.5 rounded-xl text-xs font-black">🧭 איזה מכשיר מתאים לי?</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
