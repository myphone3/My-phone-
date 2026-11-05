'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { FAQ } from '@/lib/storeInfo';

type Faq = { id: string; question: string; answer: string; product_id: string | null; sort_order: number; is_active: boolean };

const EMPTY = { question: '', answer: '', product_id: '', sort_order: '0', is_active: true };

// שאלות נפוצות: כלליות (עמוד הבית ועמודי המוצר) או לשאלה של מוצר מסוים
export default function FaqAdmin() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [f, p] = await Promise.all([
      supabase.from('faqs').select('*').order('sort_order'),
      supabase.from('products').select('id, name').order('name'),
    ]);
    setMissing(!!f.error);
    setFaqs((f.data as Faq[]) || []);
    setProducts((p.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const productName = (id: string | null) => (id ? products.find((p) => p.id === id)?.name || 'מוצר שנמחק' : 'כללי');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      product_id: form.product_id || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = editingId
      ? await supabase.from('faqs').update(payload).eq('id', editingId)
      : await supabase.from('faqs').insert(payload);
    if (error) return showToast('שגיאה בשמירה: ' + error.message, { kind: 'error' });
    showToast('השאלה נשמרה', { kind: 'success' });
    setForm(EMPTY);
    setEditingId(null);
    load();
  };

  // מעתיק לפאנל את שאלות ברירת המחדל שמוצגות היום באתר, כדי לערוך אותן
  const importDefaults = async () => {
    const { error } = await supabase.from('faqs').insert(FAQ.map((f, i) => ({ question: f.q, answer: f.a, sort_order: i, is_active: true })));
    if (error) return showToast('שגיאה: ' + error.message, { kind: 'error' });
    load();
  };

  const remove = async (f: Faq) => {
    if (!confirm('למחוק את השאלה?')) return;
    await supabase.from('faqs').delete().eq('id', f.id);
    load();
  };

  if (loading) return <div className="text-center py-20 text-gray-500" dir="rtl">טוען...</div>;
  if (missing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-sm text-amber-900 font-bold" dir="rtl">
        מסך השאלות הנפוצות יעבוד אחרי שתתווסף לבסיס הנתונים הטבלה שלו (קובץ ה-SQL שהוכן).
      </div>
    );
  }

  const input = 'w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600';

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-1">
        <h1 className="text-xl font-black text-gray-900">❓ שאלות נפוצות</h1>
        <p className="text-xs text-gray-500">
          שאלות כלליות מוצגות בעמוד הבית ובכל עמוד מוצר. שאלה שמקושרת למוצר מוצגת רק בעמוד של אותו מוצר, לפני הכלליות.
          כל עוד אין כאן שאלות, האתר מציג את שאלות ברירת המחדל.
        </p>
        {faqs.length === 0 && (
          <button onClick={importDefaults} className="mt-2 bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            ייבוא שאלות ברירת המחדל לעריכה
          </button>
        )}
      </div>

      <form onSubmit={save} className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
        <h3 className="font-black text-base text-gray-900">{editingId ? 'עריכת שאלה' : 'שאלה חדשה'}</h3>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">שאלה *</label>
          <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className={input} required />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">תשובה *</label>
          <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={3} className={input} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">שייכת ל</label>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className={input}>
              <option value="">כללי (כל האתר)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">סדר תצוגה (קטן קודם)</label>
            <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={input} />
          </div>
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
        <h3 className="font-black text-base text-gray-900">כל השאלות ({faqs.length})</h3>
        {faqs.map((f) => (
          <div key={f.id} className={`border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${f.is_active ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="text-sm font-black text-gray-900">{f.question}</div>
              <div className="text-[11px] text-orange-700 font-bold">{productName(f.product_id)}</div>
              <p className="text-xs text-gray-600 line-clamp-2">{f.answer}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditingId(f.id);
                  setForm({ question: f.question, answer: f.answer, product_id: f.product_id || '', sort_order: String(f.sort_order || 0), is_active: f.is_active });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-gray-100 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
              >
                עריכה
              </button>
              <button onClick={() => remove(f)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">מחיקה</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
