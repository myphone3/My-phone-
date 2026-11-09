'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// סימנים אמיתיים שגורמים להחליט עכשיו: כמה אנשים צפו במוצר היום, כמה מעט נשאר במלאי,
// וכמה זמן נשאר למבצע (כשהמוצר הוא "מבצע השבוע"). אין כאן מספרים מומצאים.
const pad = (n: number) => String(n).padStart(2, '0');

export default function ProductUrgency({ product }: { product: any }) {
  const [interest, setInterest] = useState<{ viewers: number; carts: number } | null>(null);
  const [dealEnd, setDealEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!product?.id) return;
    supabase.rpc('product_interest', { p_product: product.id }).then(({ data }) => data && setInterest(data as any), () => undefined);
    supabase
      .from('settings')
      .select('deal_active, deal_product_id, deal_end')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.deal_active && String(data.deal_product_id) === String(product.id) && data.deal_end) {
          const end = new Date(data.deal_end).getTime();
          if (end > Date.now()) setDealEnd(end);
        }
      }, () => undefined);
  }, [product?.id]);

  useEffect(() => {
    if (!dealEnd) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dealEnd]);

  const stock = product?.stock === null || product?.stock === undefined || product?.stock === '' ? null : Number(product.stock);
  const lowStock = stock !== null && stock > 0 && stock <= 5;
  const left = dealEnd ? dealEnd - now : 0;
  const lines: { icon: string; text: string; tone: string }[] = [];

  if (dealEnd && left > 0) {
    const d = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    lines.push({ icon: '⏰', text: `המחיר הזה נגמר בעוד ${d > 0 ? `${d} ימים ו-` : ''}${pad(h)}:${pad(m)}:${pad(s)}`, tone: 'bg-red-50 border-red-200 text-red-800' });
  }
  if (lowStock) lines.push({ icon: '🔥', text: stock === 1 ? 'נשארה יחידה אחרונה במלאי!' : `נשארו רק ${stock} יחידות במלאי`, tone: 'bg-amber-50 border-amber-200 text-amber-900' });
  if (interest?.viewers) lines.push({ icon: '👀', text: `${interest.viewers} אנשים צפו במוצר הזה ב-24 השעות האחרונות`, tone: 'bg-orange-50 border-orange-200 text-orange-900' });
  if (interest?.carts) lines.push({ icon: '🛒', text: `${interest.carts} אנשים הוסיפו אותו לעגלה היום`, tone: 'bg-orange-50 border-orange-200 text-orange-900' });

  if (!lines.length) return null;
  return (
    <div className="space-y-1.5">
      {lines.map((l) => (
        <div key={l.icon} className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-black ${l.tone}`}>
          <span className="text-base leading-none">{l.icon}</span>
          <span className="tabular-nums">{l.text}</span>
        </div>
      ))}
    </div>
  );
}
