'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Review = { id: string; name: string; rating: number; text: string; image_url: string | null; created_at: string };

const Stars = ({ value }: { value: number }) => (
  <span className="text-amber-400 text-sm tracking-tight" aria-label={`${value} מתוך 5`}>
    {'★'.repeat(value)}
    <span className="text-gray-200">{'★'.repeat(5 - value)}</span>
  </span>
);

// ביקורות לקוחות שהוזנו בפאנל. לא מוצג כלום כשאין ביקורות פעילות.
export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('id, name, rating, text, image_url, created_at')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data }) => setReviews((data as Review[]) || []));
  }, []);

  if (!reviews.length) return null;
  const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="text-center space-y-1">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900">מה הלקוחות אומרים</h2>
        <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
          <Stars value={Math.round(average)} /> {average.toFixed(1)} מתוך 5 · {reviews.length} ביקורות
        </p>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {reviews.map((r) => (
          <figure key={r.id} className="snap-start shrink-0 w-72 bg-white border border-orange-100 shadow-sm rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              {r.image_url ? (
                <img src={r.image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-black flex items-center justify-center">{r.name.trim().charAt(0)}</span>
              )}
              <div>
                <figcaption className="text-sm font-black text-gray-900">{r.name}</figcaption>
                <Stars value={r.rating} />
              </div>
            </div>
            <blockquote className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">“{r.text}”</blockquote>
          </figure>
        ))}
      </div>
    </div>
  );
}
