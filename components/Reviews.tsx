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

// ביקורות לקוחות: מוצגות רק ביקורות שאושרו בפאנל. לקוח רשום יכול לכתוב ביקורת, והיא מחכה לאישור.
export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    supabase
      .from('reviews')
      .select('id, name, rating, text, image_url, created_at')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at', { ascending: false })
      .then(({ data }) => setReviews((data as Review[]) || []));
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const startWriting = () => {
    if (!user) {
      // לא מחובר: פותחים את חלון ההרשמה
      window.dispatchEvent(new Event('open-signup'));
      return;
    }
    setName((n) => n || String(user.user_metadata?.full_name || '').trim().split(/\s+/)[0] || '');
    setState('idle');
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || text.trim().length < 5) {
      setErrorText('צריך למלא שם וכמה מילים על החוויה');
      setState('error');
      return;
    }
    setState('sending');
    const { error } = await supabase.rpc('submit_review', { p_name: name.trim(), p_rating: rating, p_text: text.trim() });
    if (error) {
      setErrorText('לא הצלחנו לשלוח, נסו שוב בעוד רגע');
      setState('error');
    } else {
      setState('sent');
    }
  };

  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900">מה הלקוחות אומרים</h2>
        {reviews.length > 0 && (
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <Stars value={Math.round(average)} /> {average.toFixed(1)} מתוך 5 · {reviews.length} ביקורות
          </p>
        )}
        <button
          type="button"
          onClick={startWriting}
          className="inline-flex items-center gap-1.5 bg-white border border-orange-200 text-orange-700 hover:bg-orange-50 px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
        >
          ✍️ קניתם אצלנו? כתבו ביקורת
        </button>
      </div>

      {reviews.length > 0 && (
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
      )}

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-3 left-3 w-8 h-8 bg-gray-100 rounded-full text-gray-500 font-bold cursor-pointer" aria-label="סגירה">
              ✕
            </button>
            {state === 'sent' ? (
              <div className="text-center space-y-2 py-6">
                <div className="text-4xl">🙏</div>
                <h3 className="text-lg font-black text-gray-900">תודה על הביקורת!</h3>
                <p className="text-sm text-gray-600">היא תופיע באתר אחרי שנאשר אותה.</p>
                <button onClick={() => setOpen(false)} className="mt-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-black cursor-pointer">סגירה</button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h3 className="text-lg font-black text-gray-900 pt-1">איך הייתה החוויה שלך?</h3>
                <div className="flex justify-center gap-1" role="radiogroup" aria-label="דירוג">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} כוכבים`}
                      onClick={() => setRating(n)}
                      className={`text-4xl leading-none cursor-pointer ${n <= rating ? 'text-amber-400' : 'text-gray-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor="review-name" className="block text-xs font-bold text-gray-700 mb-1">השם שיוצג</label>
                  <input id="review-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="w-full bg-gray-50 border rounded-xl p-3 text-sm outline-none focus:border-orange-600" />
                </div>
                <div>
                  <label htmlFor="review-text" className="block text-xs font-bold text-gray-700 mb-1">הביקורת</label>
                  <textarea
                    id="review-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={600}
                    rows={4}
                    placeholder="מה קנית, איך היה השירות והמשלוח..."
                    className="w-full bg-gray-50 border rounded-xl p-3 text-sm outline-none focus:border-orange-600"
                  />
                </div>
                {state === 'error' && <p className="text-xs font-bold text-red-600">{errorText}</p>}
                <button type="submit" disabled={state === 'sending'} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-sm font-black cursor-pointer disabled:opacity-60">
                  {state === 'sending' ? 'שולח...' : 'שליחת הביקורת'}
                </button>
                <p className="text-[11px] text-gray-400 text-center">הביקורת תופיע אחרי אישור.</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
