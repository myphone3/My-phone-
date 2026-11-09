'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FAVORITES_EVENT, getFavorites } from '@/lib/favorites';
import ProductCard from '@/components/ProductCard';

export default function FavoritesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const ids = getFavorites();
      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from('products').select('*').in('id', ids).or('is_published.is.null,is_published.eq.true');
      const byId = new Map((data || []).map((p: any) => [p.id, p]));
      setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
      setLoading(false);
    };
    load();
    window.addEventListener(FAVORITES_EVENT, load);
    return () => window.removeEventListener(FAVORITES_EVENT, load);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900">❤️ המועדפים שלי</h1>
      {loading ? (
        <p className="text-sm text-gray-500">טוען...</p>
      ) : products.length === 0 ? (
        <div className="bg-white border-2 border-orange-100 rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm text-gray-600">עוד לא שמרתם מוצרים.</p>
          <p className="text-xs text-gray-500">לחצו על הלב 🤍 בכל מוצר כדי לשמור אותו כאן.</p>
          <Link href="/" className="inline-block bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-black">לחנות</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
