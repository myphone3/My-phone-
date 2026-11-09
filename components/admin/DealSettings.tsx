'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

// הגדרת "מבצע השבוע" בדף הבית: מוצר, כותרת ותאריך סיום (לשעון הספירה לאחור)
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function DealSettings() {
  const [products, setProducts] = useState<any[]>([]);
  const [settingsId, setSettingsId] = useState<any>(null);
  const [active, setActive] = useState(false);
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        supabase.from('products').select('id, name, price, sale_price').order('name'),
        supabase.from('settings').select('id, deal_active, deal_product_id, deal_title, deal_end').limit(1).maybeSingle(),
      ]);
      setProducts(p.data || []);
      if (s.data) {
        setSettingsId(s.data.id);
        setActive(!!s.data.deal_active);
        setProductId(s.data.deal_product_id || '');
        setTitle(s.data.deal_title || '');
        setEnd(toLocalInput(s.data.deal_end));
      }
    })();
  }, []);

  const save = async () => {
    if (active && !productId) {
      showToast('צריך לבחור מוצר למבצע', { kind: 'error' });
      return;
    }
    setSaving(true);
    const payload = {
      deal_active: active,
      deal_product_id: productId || null,
      deal_title: title.trim() || null,
      deal_end: end ? new Date(end).toISOString() : null,
    };
    const res = settingsId
      ? await supabase.from('settings').update(payload).eq('id', settingsId)
      : await supabase.from('settings').insert([{ id: 1, ...payload }]).select('id').single();
    setSaving(false);
    if (res.error) {
      showToast('השמירה נכשלה: ' + res.error.message, { kind: 'error' });
      return;
    }
    if (!settingsId && (res as any).data?.id) setSettingsId((res as any).data.id);
    showToast('מבצע השבוע נשמר ✓', { kind: 'success' });
  };

  const selected = products.find((p) => String(p.id) === productId);
  const noSalePrice = selected && !(Number(selected.sale_price) > 0 && Number(selected.sale_price) < Number(selected.price));

  return (
    <div className="bg-gradient-to-l from-orange-50 to-white p-5 sm:p-6 rounded-3xl border-2 border-orange-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-gray-900">⚡ מבצע השבוע בדף הבית</h2>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-5 h-5 accent-orange-600" />
          {active ? 'מוצג באתר' : 'כבוי'}
        </label>
      </div>
      <p className="text-xs text-gray-500">אזור גדול ובולט מתחת לבאנר, עם שעון ספירה לאחור. כשהזמן נגמר הוא נעלם לבד.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs font-bold text-gray-700 space-y-1">
          <span>המוצר</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full bg-white border rounded-xl p-2.5 text-sm">
            <option value="">בחירת מוצר...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · ₪{p.sale_price || p.price}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-gray-700 space-y-1">
          <span>כותרת (לא חובה)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="מבצע השבוע" className="w-full bg-white border rounded-xl p-2.5 text-sm" />
        </label>
        <label className="block text-xs font-bold text-gray-700 space-y-1">
          <span>מסתיים ב- (לשעון הספירה)</span>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-white border rounded-xl p-2.5 text-sm" />
        </label>
        <div className="flex items-end">
          <button onClick={save} disabled={saving} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl text-sm font-black cursor-pointer disabled:opacity-60">
            {saving ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </div>
      {noSalePrice && (
        <p className="text-[11px] font-bold text-amber-700">💡 למוצר הזה אין מחיר מבצע, ולכן לא יוצג מחיר מחוק ואחוז הנחה. אפשר להגדיר מחיר מבצע במסך המוצרים.</p>
      )}
    </div>
  );
}
