'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { fetchAll } from '@/lib/fetchAll';
import { LoadErrorBox } from '@/components/admin/LoadErrorBox';

type Product = { id: string; name: string; price: number | null; sale_price: number | null; stock: number | null; image_url?: string | null; images?: any; brand?: string | null; category?: string | null };
type Draft = { price: string; sale_price: string; stock: string };

const toDraft = (p: Product): Draft => ({
  price: p.price == null ? '' : String(p.price),
  sale_price: p.sale_price == null ? '' : String(p.sale_price),
  stock: p.stock == null ? '' : String(p.stock),
});

const imageOf = (p: Product) => p.image_url || (Array.isArray(p.images) ? p.images[0] : '') || '';

// עריכה מהירה: מחיר, מחיר מבצע ומלאי של הרבה מוצרים במסך אחד
export default function QuickEditProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'up%' | 'down%' | 'up' | 'down'>('up%');
  const [bulkValue, setBulkValue] = useState('');

  // keep: טיוטות שלא נשמרו (למשל שמירה שנכשלה) נשארות אחרי הטעינה מחדש
  const load = async (keep: Record<string, Draft> = {}) => {
    setLoading(true);
    const { data, error } = await fetchAll<Product>((a, b) =>
      supabase.from('products').select('id, name, price, sale_price, stock, image_url, images, brand, category').order('name').order('id').range(a, b)
    );
    setLoadError(error ? error.message || 'שגיאה בטעינה' : '');
    if (!error) {
      setProducts(data);
      setDrafts(Object.fromEntries(data.map((p) => [p.id, keep[p.id] || toDraft(p)])));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const changedIds = useMemo(
    () =>
      products
        .filter((p) => {
          const d = drafts[p.id];
          const o = toDraft(p);
          return d && (d.price !== o.price || d.sale_price !== o.sale_price || d.stock !== o.stock);
        })
        .map((p) => p.id),
    [products, drafts]
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (!q || p.name.toLowerCase().includes(q)) && (!brand || p.brand === brand) && (!category || p.category === category)
    );
  }, [products, search, brand, category]);

  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort() as string[], [products]);
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort() as string[], [products]);

  // שינוי מחיר לכל המוצרים שמוצגים כרגע (לפי החיפוש והסינון). נכנס כטיוטה, ונשמר רק בלחיצה על "שמירה".
  const applyBulk = () => {
    const v = Number(bulkValue);
    if (!(v > 0)) return showToast('צריך לכתוב מספר גדול מ-0', { kind: 'error' });
    if (bulkMode === 'down%' && v >= 100) return showToast('אי אפשר להוריד 100% או יותר', { kind: 'error' });
    const calc = (n: number) => {
      const r = bulkMode === 'up%' ? n * (1 + v / 100) : bulkMode === 'down%' ? n * (1 - v / 100) : bulkMode === 'up' ? n + v : n - v;
      return Math.max(1, Math.round(r));
    };
    setDrafts((prev) => {
      const next = { ...prev };
      for (const p of shown) {
        const d = next[p.id];
        if (!d || d.price === '' || !(Number(d.price) > 0)) continue;
        const price = calc(Number(d.price));
        // מחיר מבצע זז באותו יחס, וגם נשאר נמוך מהמחיר
        const sale = d.sale_price !== '' && Number(d.sale_price) > 0 ? Math.min(calc(Number(d.sale_price)), price - 1) : null;
        next[p.id] = { ...d, price: String(price), sale_price: sale && sale > 0 ? String(sale) : '' };
      }
      return next;
    });
    setBulkOpen(false);
    setBulkValue('');
    showToast(`המחירים עודכנו ב-${shown.length} מוצרים. בדקו ולחצו "שמירה".`, { kind: 'success' });
  };

  const setField = (id: string, field: keyof Draft, value: string) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const save = async () => {
    // בדיקה לפני שמירה: מחיר חובה וחיובי, מחיר מבצע נמוך מהמחיר, מלאי מספר שלם
    for (const id of changedIds) {
      const d = drafts[id];
      const name = products.find((p) => p.id === id)?.name;
      const price = Number(d.price);
      if (d.price === '' || !(price > 0)) return showToast(`מחיר לא תקין: ${name}`, { kind: 'error' });
      if (d.sale_price !== '' && !(Number(d.sale_price) > 0 && Number(d.sale_price) < price)) return showToast(`מחיר המבצע צריך להיות נמוך מהמחיר: ${name}`, { kind: 'error' });
      if (d.stock !== '' && !(Number.isInteger(Number(d.stock)) && Number(d.stock) >= 0)) return showToast(`מלאי לא תקין: ${name}`, { kind: 'error' });
    }
    setSaving(true);
    const failed: string[] = [];
    const keep: Record<string, Draft> = {};
    for (const id of changedIds) {
      const d = drafts[id];
      const product = products.find((p) => p.id === id)!;
      const o = toDraft(product);
      // נשמרים רק השדות ששונו, כדי לא לדרוס שינוי שמישהו אחר עשה בינתיים בשדה אחר
      const update: Record<string, number | null> = {};
      if (d.price !== o.price) update.price = Number(d.price);
      if (d.sale_price !== o.sale_price) update.sale_price = d.sale_price === '' ? null : Number(d.sale_price);
      if (d.stock !== o.stock) update.stock = d.stock === '' ? null : Number(d.stock);
      const { error } = await supabase.from('products').update(update).eq('id', id);
      if (error) {
        failed.push(product.name || id);
        keep[id] = d;
      }
    }
    if (failed.length) showToast(`לא נשמרו: ${failed.join(', ')}. השינויים שלהם נשארו, אפשר לנסות שוב.`, { kind: 'error' });
    else showToast(`נשמרו ${changedIds.length} מוצרים`, { kind: 'success' });
    await load(keep);
    setSaving(false);
  };

  if (loading) return <div className="text-center py-20 text-gray-500" dir="rtl">טוען מוצרים...</div>;
  if (loadError) return <LoadErrorBox error={loadError} what="המוצרים" onRetry={() => load()} />;

  const input = 'w-full bg-gray-50 border rounded-lg px-2 py-2 text-sm outline-none focus:border-orange-600';

  return (
    <div className="space-y-4 pb-24" dir="rtl">
      <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-1">
        <Link href="/admin/products" className="text-xs font-bold text-orange-700 hover:underline">→ חזרה לניהול מוצרים</Link>
        <h1 className="text-xl font-black text-gray-900">⚡ עריכה מהירה</h1>
        <p className="text-xs text-gray-500">משנים מחיר, מחיר מבצע ומלאי, ושומרים את כל השינויים בלחיצה אחת. מחיר מבצע ריק = אין מבצע.</p>
      </div>

      <div className="bg-white p-3 rounded-2xl border space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר..."
          className="w-full bg-gray-50 border rounded-xl p-3 text-xs outline-none focus:border-orange-600"
        />
        <div className="grid grid-cols-2 gap-2">
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className="bg-gray-50 border rounded-xl p-2.5 text-xs">
            <option value="">כל המותגים</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-gray-50 border rounded-xl p-2.5 text-xs">
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setBulkOpen((o) => !o)}
          className="w-full bg-orange-50 border border-orange-200 text-orange-700 rounded-xl py-2.5 text-xs font-black cursor-pointer"
        >
          💸 שינוי מחיר ל-{shown.length} המוצרים שמוצגים
        </button>
        {bulkOpen && (
          <div className="bg-orange-50/60 border border-orange-200 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value as any)} className="bg-white border rounded-xl p-2.5 text-xs">
                <option value="up%">העלאה באחוזים (%)</option>
                <option value="down%">הורדה באחוזים (%)</option>
                <option value="up">העלאה בשקלים (₪)</option>
                <option value="down">הורדה בשקלים (₪)</option>
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkMode.endsWith('%') ? 'למשל 5' : 'למשל 20'}
                className="bg-white border rounded-xl p-2.5 text-xs outline-none focus:border-orange-600"
              />
            </div>
            <p className="text-[11px] text-gray-500">המחיר ומחיר המבצע ישתנו בכל המוצרים שברשימה למטה, מעוגל לשקל שלם. שום דבר לא נשמר עד שלוחצים "שמירה".</p>
            <button type="button" onClick={applyBulk} className="w-full bg-orange-600 text-white rounded-xl py-2.5 text-xs font-black cursor-pointer">
              החלה על {shown.length} מוצרים
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border shadow-sm divide-y">
        {shown.map((p) => {
          const d = drafts[p.id];
          const changed = changedIds.includes(p.id);
          return (
            <div key={p.id} className={`p-3 space-y-2 ${changed ? 'bg-orange-50' : ''}`}>
              <div className="flex items-center gap-2">
                {imageOf(p) ? <img src={imageOf(p)} alt="" className="w-9 h-9 object-contain bg-gray-50 rounded-lg border shrink-0" /> : null}
                <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                {changed && <span className="text-[10px] font-bold text-orange-700 mr-auto">שונה</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['price', 'מחיר ₪', '0.01'],
                  ['sale_price', 'מבצע ₪', '0.01'],
                  ['stock', 'מלאי', '1'],
                ] as const).map(([field, label, step]) => (
                  <label key={field} className="block">
                    <span className="block text-[10px] font-bold text-gray-500 mb-0.5">{label}</span>
                    <input
                      type="number"
                      inputMode={field === 'stock' ? 'numeric' : 'decimal'}
                      min="0"
                      step={step}
                      value={d[field]}
                      disabled={saving}
                      onChange={(e) => setField(p.id, field, e.target.value)}
                      className={input}
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {changedIds.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-6 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3">
          <span className="text-xs font-bold">{changedIds.length} מוצרים שונו</span>
          <div className="flex gap-2">
            <button disabled={saving} onClick={() => setDrafts(Object.fromEntries(products.map((p) => [p.id, toDraft(p)])))} className="bg-white/10 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">ביטול</button>
            <button onClick={save} disabled={saving} className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-xl text-xs font-black cursor-pointer">
              {saving ? 'שומר...' : 'שמירת השינויים'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
