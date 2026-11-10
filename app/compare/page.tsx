'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { COMPARE_EVENT, COMPARE_MAX, clearCompare, getCompare, removeFromCompare } from '@/lib/shop';
import { showAddedToCart } from '@/lib/toast';
import { versionName } from '@/lib/versionPrice';

const asArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const v = JSON.parse(val);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
};

const priceOf = (p: any) => Number(p.sale_price && Number(p.sale_price) < Number(p.price) ? p.sale_price : p.price) || 0;
const imageOf = (p: any) => p.image_url || asArray(p.images)[0] || '';
const plain = (md: any) =>
  String(md || '')
    .replace(/[#*_`>]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();

// השורות בטבלה: רק שורות שיש בהן ערך לפחות במוצר אחד
const ROWS: { label: string; value: (p: any) => string }[] = [
  { label: 'מותג', value: (p) => p.brand || '' },
  { label: 'קטגוריה', value: (p) => p.category || '' },
  { label: 'כשרות', value: (p) => p.kosher || '' },
  { label: 'נפח אחסון', value: (p) => p.spec_storage || p.storage || '' },
  { label: 'זיכרון (RAM)', value: (p) => p.spec_ram || '' },
  { label: 'סוללה', value: (p) => p.spec_battery || '' },
  { label: 'אחריות', value: (p) => p.warranty || '' },
  {
    label: 'צבעים',
    value: (p) =>
      asArray(p.product_colors || p.colors)
        .map((c) => (typeof c === 'object' ? c?.name : c))
        .filter(Boolean)
        .join(', '),
  },
  {
    label: 'גרסאות',
    value: (p) =>
      asArray(p.product_variants || p.versions || p.product_versions)
        .map(versionName)
        .filter(Boolean)
        .join(', '),
  },
  {
    label: 'מלאי',
    value: (p) => (p.stock === null || p.stock === undefined || p.stock === '' ? 'במלאי' : Number(p.stock) <= 0 ? 'אזל' : Number(p.stock) <= 3 ? `נשארו ${p.stock}` : 'במלאי'),
  },
  { label: 'בקצרה', value: (p) => plain(p.short_description) },
  { label: 'מפרט', value: (p) => plain(p.specs) },
];

export default function ComparePage() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const update = () => setIds(getCompare());
    update();
    window.addEventListener(COMPARE_EVENT, update);
    return () => window.removeEventListener(COMPARE_EVENT, update);
  }, []);

  useEffect(() => {
    if (!ids) return;
    if (!ids.length) {
      setProducts([]);
      return;
    }
    supabase
      .from('products')
      .select('*')
      .in('id', ids)
      .then(({ data }) => {
        const byId = new Map((data || []).map((p: any) => [String(p.id), p]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
      });
  }, [ids]);

  const cheapest = products.length > 1 ? Math.min(...products.map(priceOf)) : -1;
  const rows = ROWS.filter((r) => products.some((p) => r.value(p)));

  const addToCart = (p: any) => {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const id = `${p.id}--`;
      const existing = cart.find((i: any) => i.id === id);
      if (existing) existing.quantity = (Number(existing.quantity) || 1) + 1;
      else cart.push({ id, productId: p.id, name: p.name, price: priceOf(p), image: imageOf(p), color: '', version: '', quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));
      showAddedToCart();
    } catch {
      // ignore
    }
  };

  // מוצר עם כמה צבעים/גרסאות: בוחרים בעמוד המוצר
  const needsChoice = (p: any) => asArray(p.product_colors || p.colors).length > 1 || asArray(p.product_variants || p.versions || p.product_versions).length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2"><Icon name="compare" size={26} className="text-orange-600" /> השוואת מוצרים</h1>
          <p className="text-xs text-gray-500 mt-1 pr-4">עד {COMPARE_MAX} מוצרים זה לצד זה</p>
        </div>
        {products.length > 0 && (
          <button onClick={clearCompare} className="text-xs font-bold text-gray-500 hover:text-red-600 cursor-pointer shrink-0">
            ניקוי הכל
          </button>
        )}
      </div>

      {ids === null ? (
        <p className="text-center py-20 text-gray-500">טוען...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
          <div className="flex justify-center text-gray-300"><Icon name="compare" size={56} strokeWidth={1.3} /></div>
          <p className="font-black text-gray-900">עוד לא בחרתם מוצרים להשוואה</p>
          <p className="text-sm text-gray-500">לחצו על &quot;השוואה&quot; בכרטיס של מוצר, ואפשר להוסיף עד {COMPARE_MAX}</p>
          <Link href="/" className="inline-block bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-black mt-2">לבחירת מוצרים</Link>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[520px]">
            <thead>
              <tr>
                <th className="w-24 sm:w-32 p-3 bg-gray-50 border-b" />
                {products.map((p) => (
                  <th key={p.id} className="p-3 border-b border-r align-top font-normal">
                    <div className="space-y-2 relative">
                      <button
                        onClick={() => removeFromCompare(String(p.id))}
                        className="absolute -top-1 -left-1 w-7 h-7 rounded-full bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 cursor-pointer"
                        aria-label={`הסרת ${p.name} מההשוואה`}
                      >
                        ✕
                      </button>
                      <Link href={`/product/${p.id}`} className="block">
                        <div className="h-28 sm:h-36 bg-gray-50 rounded-xl flex items-center justify-center p-2">
                          {imageOf(p) && <img src={imageOf(p)} alt={p.name} className="max-h-full object-contain" />}
                        </div>
                        <span className="block font-black text-gray-900 text-xs sm:text-sm mt-2 leading-snug" dir="auto">
                          {p.name}
                        </span>
                      </Link>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-base font-black text-orange-600">₪{priceOf(p)}</span>
                        {priceOf(p) < Number(p.price) && <span className="text-gray-400 line-through">₪{p.price}</span>}
                      </div>
                      {priceOf(p) === cheapest && <span className="inline-block bg-green-100 text-green-800 font-black px-2 py-0.5 rounded-lg">💰 הכי משתלם</span>}
                      {needsChoice(p) ? (
                        <Link href={`/product/${p.id}`} className="block text-center bg-orange-50 text-orange-700 border border-orange-200 py-2 rounded-xl font-black">
                          לבחירת צבע וגרסה
                        </Link>
                      ) : (
                        <button onClick={() => addToCart(p)} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-xl font-black cursor-pointer">
                          הוספה לעגלה 🛒
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {products.length < COMPARE_MAX && (
                  <th className="p-3 border-b border-r align-middle w-32">
                    <Link href="/" className="flex flex-col items-center justify-center gap-1 h-36 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-orange-600 hover:border-orange-300">
                      <span className="text-2xl">+</span>
                      <span className="font-bold">הוספת מוצר</span>
                    </Link>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const values = products.map((p) => r.value(p));
                const allSame = values.length > 1 && values.every((v) => v === values[0]);
                return (
                  <tr key={r.label} className="even:bg-gray-50/50">
                    <th className="p-3 text-right font-black text-gray-700 border-b bg-gray-50 align-top">{r.label}</th>
                    {values.map((v, i) => (
                      <td key={i} className={`p-3 border-b border-r align-top whitespace-pre-line leading-relaxed ${allSame ? 'text-gray-400' : 'text-gray-800'}`} dir="auto">
                        {v || '—'}
                      </td>
                    ))}
                    {products.length < COMPARE_MAX && <td className="border-b border-r" />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
