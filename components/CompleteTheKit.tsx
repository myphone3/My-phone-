'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

// "השלימו את הערכה": אביזרים שמתאימים למה שבעגלה.
// קודם מוצרים שלקוחות קנו יחד עם המוצרים שבעגלה (also_bought), ואם אין, מוצרים מקטגוריית אביזרים.
const ACCESSORY_RE = /אביזר|כיסוי|מגן|מטען|כבל|אוזני|סוללה ניידת|כרטיס זיכרון|נרתיק/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export default function CompleteTheKit({ cartItems }: { cartItems: any[] }) {
  const [items, setItems] = useState<any[]>([]);
  const inCart = new Set(cartItems.map((i) => String(i.productId || String(i.id || '').match(UUID_RE)?.[0] || '')));
  const key = Array.from(inCart).sort().join(',');

  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    let alive = true;
    (async () => {
      const ids = key.split(',').filter(Boolean);
      const found = new Map<string, any>();
      // מוצרים שנקנו יחד
      for (const id of ids.slice(0, 3)) {
        try {
          const { data } = await supabase.rpc('also_bought', { p_product_id: id, p_limit: 4 });
          for (const row of (data as any[]) || []) {
            const pid = String(row.product_id || row.id || '');
            if (pid && !inCart.has(pid)) found.set(pid, row);
          }
        } catch {
          // ignore
        }
      }
      let list: any[] = [];
      if (found.size) {
        const { data } = await supabase.from('products').select('*').in('id', Array.from(found.keys())).or('is_published.is.null,is_published.eq.true');
        list = data || [];
      }
      // אביזרים לפי קטגוריה/שם
      if (list.length < 3) {
        const { data } = await supabase.from('products').select('*').or('is_published.is.null,is_published.eq.true').lte('price', 300);
        const extra = (data || []).filter(
          (p: any) => !inCart.has(String(p.id)) && !list.some((x) => x.id === p.id) && ACCESSORY_RE.test(`${p.category || ''} ${p.name || ''} ${p.tags || ''}`)
        );
        list = [...list, ...extra];
      }
      list = list.filter((p) => p.stock === null || p.stock === undefined || Number(p.stock) > 0).slice(0, 4);
      if (alive) setItems(list);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!items.length) return null;

  const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;
  const hasChoices = (p: any) => {
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return arr(p.product_colors).length > 1 || arr(p.product_variants).length > 0;
  };

  const add = (p: any) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const id = `${p.id}--`;
      const existing = cart.find((i: any) => i.id === id);
      if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
      else cart.push({ id, productId: p.id, name: p.name, price: priceOf(p), image: p.image_url || (Array.isArray(p.images) ? p.images[0] : '') || '', color: '', version: '', quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      showToast('נוסף לעגלה ✓', { kind: 'success' });
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white border-2 border-orange-100 rounded-2xl p-4 space-y-3">
      <h3 className="text-sm font-black text-gray-900">🧩 השלימו את הערכה</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((p) => (
          <div key={p.id} className="bg-gray-50 rounded-xl border border-gray-100 p-2 flex flex-col gap-2">
            <Link href={`/product/${p.id}`} className="block">
              <div className="h-20 bg-white rounded-lg flex items-center justify-center p-1">
                {(p.image_url || p.images?.[0]) && <img loading="lazy" decoding="async" src={p.image_url || p.images?.[0]} alt={p.name} className="max-h-full object-contain" />}
              </div>
              <span className="block text-[11px] font-bold text-gray-800 mt-1.5 line-clamp-2 leading-snug" dir="auto">
                {p.name}
              </span>
            </Link>
            <div className="flex items-center justify-between gap-1 mt-auto">
              <span className="text-xs font-black text-orange-600">₪{priceOf(p)}</span>
              {hasChoices(p) ? (
                <Link href={`/product/${p.id}`} className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg">
                  לבחירה
                </Link>
              ) : (
                <button onClick={() => add(p)} className="text-[10px] font-black text-white bg-orange-600 hover:bg-orange-700 px-2.5 py-1 rounded-lg cursor-pointer">
                  + הוספה
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
