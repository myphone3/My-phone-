'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// "מבצע השבוע": מוצר אחד גדול בדף הבית עם שעון ספירה לאחור. נבחר בפאנל (באנרים ← מבצע השבוע).
// כשהזמן נגמר, האזור נעלם לבד.

const pad = (n: number) => String(n).padStart(2, '0');

export default function DealOfWeek({ settings, products }: { settings: any; products: any[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!settings?.deal_active || !settings?.deal_product_id || now === null) return null;
  const product = products.find((p) => String(p.id) === String(settings.deal_product_id));
  if (!product) return null;

  const end = settings.deal_end ? new Date(settings.deal_end).getTime() : 0;
  const left = end ? end - now : 0;
  if (end && left <= 0) return null;

  const price = Number(product.sale_price || product.price) || 0;
  const regular = Number(product.price) || 0;
  const percent = regular > price ? Math.round((1 - price / regular) * 100) : 0;
  const image = product.image_url || (Array.isArray(product.images) ? product.images[0] : '') || '';

  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-950 via-gray-900 to-orange-950 text-white shadow-xl" dir="rtl">
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-orange-600/30 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 sm:p-10 items-center">
        <div className="space-y-4 order-2 sm:order-1">
          <span className="inline-flex items-center gap-1.5 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-black">
            ⚡ {settings.deal_title?.trim() || 'מבצע השבוע'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black leading-tight" dir="auto">
            {product.name}
          </h2>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl sm:text-5xl font-black text-orange-400">₪{price}</span>
            {percent > 0 && (
              <>
                <span className="text-lg text-gray-400 line-through">₪{regular}</span>
                <span className="bg-green-500 text-white text-sm font-black px-2.5 py-1 rounded-lg">{percent}% הנחה</span>
              </>
            )}
          </div>

          {end > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-gray-300 font-bold">המבצע נגמר בעוד:</span>
              <div className="flex gap-2" dir="ltr">
                {[
                  [d, 'ימים'],
                  [h, 'שעות'],
                  [m, 'דקות'],
                  [s, 'שניות'],
                ]
                  .filter(([v, l]) => l !== 'ימים' || Number(v) > 0)
                  .map(([v, l]) => (
                    <div key={String(l)} className="bg-white/10 backdrop-blur border border-white/15 rounded-xl w-16 py-2 text-center">
                      <span className="block text-2xl font-black tabular-nums">{pad(Number(v))}</span>
                      <span className="block text-[10px] text-gray-300 font-bold">{l}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <Link
            href={`/product/${product.id}`}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3.5 rounded-2xl text-sm font-black shadow-lg transition"
          >
            לפרטים ולקנייה <span>←</span>
          </Link>
        </div>

        <Link href={`/product/${product.id}`} className="order-1 sm:order-2 flex items-center justify-center">
          <div className="w-56 h-56 sm:w-80 sm:h-80 rounded-full bg-white/95 shadow-2xl flex items-center justify-center p-8 hover:scale-105 transition duration-300">
            {image ? <img src={image} alt={product.name} className="max-h-full max-w-full object-contain" /> : <span className="text-6xl">📱</span>}
          </div>
        </Link>
      </div>
    </section>
  );
}
