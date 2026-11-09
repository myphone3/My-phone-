'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { COMPARE_EVENT, getCompare, removeFromCompare } from '@/lib/compare';
import { versionName } from '@/lib/versionPrice';
import ProductCard from '@/components/ProductCard';

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

const names = (val: any) =>
  asArray(val)
    .map((v) => (typeof v === 'object' ? v?.name : v))
    .filter(Boolean)
    .join(' / ');

// שורות הטבלה: מוצגות רק שורות שיש בהן מידע לפחות במכשיר אחד
const ROWS: { label: string; value: (p: any) => string }[] = [
  { label: 'מחיר', value: (p) => `₪${Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0}` },
  { label: 'מותג', value: (p) => p.brand || '' },
  { label: 'קטגוריה', value: (p) => p.category || '' },
  { label: 'כשרות', value: (p) => p.kosher || '' },
  { label: 'גרסאות', value: (p) => asArray(p.product_variants || p.versions).map(versionName).filter(Boolean).join(' / ') },
  { label: 'צבעים', value: (p) => names(p.product_colors || p.colors) },
  { label: 'זיכרון', value: (p) => p.spec_storage || p.storage || '' },
  { label: 'זיכרון RAM', value: (p) => p.spec_ram || '' },
  { label: 'סוללה', value: (p) => p.spec_battery || '' },
  { label: 'אחריות', value: (p) => p.warranty || '' },
  { label: 'במלאי', value: (p) => (p.stock == null ? '' : Number(p.stock) > 0 ? '✔ במלאי' : '✖ אזל') },
];

export default function ComparePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const ids = getCompare();
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
    window.addEventListener(COMPARE_EVENT, load);
    return () => window.removeEventListener(COMPARE_EVENT, load);
  }, []);

  const rows = ROWS.filter((r) => products.some((p) => r.value(p)));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900">⚖️ השוואת מכשירים</h1>

      {loading ? (
        <p className="text-sm text-gray-500">טוען...</p>
      ) : products.length === 0 ? (
        <div className="bg-white border-2 border-orange-200 rounded-3xl p-8 text-center space-y-3">
          <p className="text-sm text-gray-600">עוד לא בחרתם מכשירים להשוואה.</p>
          <p className="text-xs text-gray-500">בכל כרטיס מוצר יש כפתור "⚖️ השוואה". בחרו עד 3 מכשירים.</p>
          <Link href="/" className="inline-block bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-black">
            לחנות
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white border-2 border-orange-200 rounded-3xl">
            <table className="w-full text-sm table-fixed" style={{ minWidth: products.length > 2 ? 520 : undefined }}>
              <thead>
                <tr className="bg-orange-50">
                  <th className="p-2 w-20" />
                  {products.map((p) => (
                    <th key={p.id} className="p-2 align-top">
                      <img src={p.image_url || asArray(p.images)[0]} alt="" className="h-16 mx-auto object-contain" />
                      <Link href={`/product/${p.id}`} className="block mt-2 font-black text-gray-900 hover:text-orange-600" dir="auto">
                        {p.name}
                      </Link>
                      <button
                        onClick={() => removeFromCompare(p.id)}
                        className="mt-1 text-[11px] text-gray-400 hover:text-red-600 cursor-pointer"
                      >
                        הסרה ✕
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-orange-100">
                    <th scope="row" className="p-2 text-right text-xs font-bold text-gray-500">{r.label}</th>
                    {products.map((p) => (
                      <td key={p.id} className={`p-2 text-center break-words ${r.label === 'מחיר' ? 'font-black text-orange-600' : 'text-gray-800'}`} dir="auto">
                        {r.value(p) || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
