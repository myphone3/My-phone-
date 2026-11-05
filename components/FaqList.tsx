'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FAQ } from '@/lib/storeInfo';

type Faq = { id: string; q: string; a: string };

// שאלות נפוצות מהפאנל (טבלת faqs). בעמוד מוצר מוצגות גם השאלות של אותו מוצר.
// אם עדיין אין שאלות בפאנל, מוצגות שאלות ברירת המחדל.
export default function FaqList({ productId }: { productId?: string }) {
  const [items, setItems] = useState<Faq[]>(FAQ.map((f, i) => ({ id: `default-${i}`, ...f })));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase.from('faqs').select('id, question, answer, product_id').eq('is_active', true).order('sort_order');
      query = productId ? query.or(`product_id.is.null,product_id.eq.${productId}`) : query.is('product_id', null);
      const { data, error } = await query;
      if (cancelled || error || !data?.length) return;
      // שאלות של המוצר עצמו קודם
      const sorted = [...data].sort((a: any, b: any) => (b.product_id ? 1 : 0) - (a.product_id ? 1 : 0));
      setItems(sorted.map((f: any) => ({ id: f.id, q: f.question, a: f.answer })));
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <div className="space-y-2" dir="rtl">
      {items.map((item) => (
        <details key={item.id} className="group bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-xs">
          <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-bold text-gray-900">
            <span>{item.q}</span>
            <span className="text-orange-600 text-lg leading-none transition group-open:rotate-45">+</span>
          </summary>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pt-2 whitespace-pre-line">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
