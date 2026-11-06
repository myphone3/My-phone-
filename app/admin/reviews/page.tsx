'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { LoadErrorBox, isMissingTable } from '@/components/admin/LoadErrorBox';

type Review = { id: string; name: string; rating: number; text: string; image_url: string | null; sort_order: number; is_active: boolean; source?: string | null; created_at?: string };

const EMPTY = { name: '', rating: '5', text: '', image_url: '', sort_order: '0', is_active: true };

// ביקורות לקוחות: מזינים רק ביקורות אמיתיות (למשל מגוגל או מוואטסאפ, באישור הלקוח)
export default function ReviewsAdmin() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase.from('reviews').select('*').order('sort_order').order('created_at', { ascending: false });
    setLoadError(error ? (isMissingTable(error) ? 'missing' : error.message || 'שגיאה בטעינה') : '');
    setReviews((data as Review[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      rating: Math.min(5, Math.max(1, Number(form.rating) || 5)),
      text: form.text.trim(),
      image_url: form.image_url.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    if (!payload.name || !payload.text) return showToast('צריך למלא שם וביקורת', { kind: 'error' });
    const { error } = editingId
      ? await supabase.from('reviews').update(payload).eq('id', editingId)
      : await supabase.from('reviews').insert(payload);
    if (error) return showToast('שגיאה בשמירה: ' + error.message, { kind: 'error' });
    showToast('הביקורת נשמרה', { kind: 'success' });
    setForm(EMPTY);
    setEditingId(null);
    load();
  };

  const toggle = async (r: Review) => {
    const { error } = await supabase.from('reviews').update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) return showToast('שגיאה בעדכון: ' + error.message, { kind: 'error' });
    load();
  };

  const remove = async (r: Review) => {
    if (!confirm(`למחוק את הביקורת של ${r.name}?`)) return;
    const { error } = await supabase.from('reviews').delete().eq('id', r.id);
    if (error) return showToast('שגיאה במחיקה: ' + error.message, { kind: 'error' });
    load();
  };

  if (loading) return <div className="text-center py-20 text-gray-500" dir="rtl">טוען...</div>;
  if (loadError) return <LoadErrorBox error={loadError} what="הביקורות" onRetry={() => { setLoading(true); load(); }} />;

  const input = 'w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600';

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-1">
        <h1 className="text-xl font-black text-gray-900">⭐ ביקורות לקוחות</h1>
        <p className="text-xs text-gray-500">הביקורות הפעילות מוצגות בעמוד הבית. הזינו רק ביקורות אמיתיות של לקוחות.</p>
      </div>

      <form onSubmit={save} className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
        <h3 className="font-black text-base text-gray-900">{editingId ? 'עריכת ביקורת' : 'ביקורת חדשה'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שם הלקוח *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">דירוג</label>
            <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className={input}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סדר תצוגה (קטן קודם)</label>
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={input} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">הביקורת *</label>
          <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={3} className={input} required />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">קישור לתמונת הלקוח (לא חובה)</label>
          <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className={input} dir="ltr" />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-orange-600" />
          מוצגת באתר
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer">{editingId ? 'שמירה' : 'הוספה'}</button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="bg-gray-100 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer">ביטול</button>
          )}
        </div>
      </form>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
        {reviews.some((r) => r.source === 'customer' && !r.is_active) && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 text-xs font-bold text-orange-800">
            יש ביקורות חדשות מלקוחות שמחכות לאישור. לחיצה על "אישור והצגה" מפרסמת אותן באתר.
          </div>
        )}
        <h3 className="font-black text-base text-gray-900">כל הביקורות ({reviews.length})</h3>
        {reviews.length === 0 && <p className="text-xs text-gray-500">עדיין אין ביקורות.</p>}
        {[...reviews].sort((a, b) => Number(b.source === 'customer' && !b.is_active) - Number(a.source === 'customer' && !a.is_active)).map((r) => (
          <div key={r.id} className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${r.is_active || r.source === 'customer' ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-sm font-black text-gray-900">
                {r.name} <span className="text-amber-400">{'★'.repeat(r.rating)}</span>
                {r.source === 'customer' && (
                  <span className={`mr-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.is_active ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                    {r.is_active ? 'נכתבה ע"י לקוח' : 'מחכה לאישור'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{r.text}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => toggle(r)} className="bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">{r.is_active ? 'הסתרה' : r.source === 'customer' ? 'אישור והצגה ✓' : 'הצגה'}</button>
              <button
                onClick={() => {
                  setEditingId(r.id);
                  setForm({ name: r.name, rating: String(r.rating), text: r.text, image_url: r.image_url || '', sort_order: String(r.sort_order || 0), is_active: r.is_active });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                עריכה
              </button>
              <button onClick={() => remove(r)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">מחיקה</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
