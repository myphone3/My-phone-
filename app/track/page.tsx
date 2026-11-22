'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, orderItems, orderTotals, statusBadge } from '@/lib/orders';
import { StatusTrack } from '@/components/MyOrders';
import { BUSINESS } from '@/lib/business';
import Icon from '@/components/Icon';
import { track } from '@/lib/track';

type Tracked = {
  order_number: string;
  created_at: string;
  status: string;
  items: any[];
  subtotal: number | null;
  discount_amount: number | null;
  shipping_cost: number | null;
  total_price: number | null;
  shipped_at: string | null;
  completed_at: string | null;
  city: string | null;
};

// מעקב הזמנה בלי להתחבר: מספר ההזמנה (8 ספרות) + מספר הטלפון שהוזן בהזמנה
function TrackContent() {
  const params = useSearchParams();
  const [num, setNum] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Tracked | null>(null);

  useEffect(() => {
    const n = params.get('n');
    if (n) setNum(n.replace(/\D/g, '').slice(0, 8));
  }, [params]);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = num.replace(/\D/g, '');
    const p = phone.replace(/\D/g, '');
    if (n.length !== 8) return setError('מספר ההזמנה הוא 8 ספרות (מופיע במייל אישור ההזמנה)');
    if (p.length < 9) return setError('נא להזין את מספר הטלפון שמסרתם בהזמנה');
    setBusy(true);
    const { data, error: err } = await supabase.rpc('track_order', { p_number: n, p_phone: p });
    setBusy(false);
    if (err) return setError('משהו השתבש. נסו שוב עוד רגע.');
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return setError('לא מצאנו הזמנה עם המספר והטלפון האלה. כדאי לבדוק שוב את הספרות.');
    setOrder(row as Tracked);
    track('track_order');
  };

  if (order) {
    const asOrder = { id: order.order_number, ...order } as any;
    const items = orderItems(asOrder);
    const totals = orderTotals(asOrder);
    const badge = statusBadge(order.status);
    const images = (order.items || []).map((i: any) => i?.image || '');
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-3xl border-2 border-orange-100 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <span className="block text-[11px] font-bold text-gray-500">הזמנה מספר</span>
              <span className="text-xl font-black text-gray-900" dir="ltr">#{order.order_number}</span>
              <span className="block text-[11px] text-gray-500 mt-0.5">הוזמנה ב-{formatDate(order.created_at, true)}</span>
            </div>
            <span className={`text-xs font-black px-3 py-1.5 rounded-full ${badge.className}`}>{badge.label}</span>
          </div>

          {order.status === 'מבוטל' ? (
            <p className="text-sm text-red-700 bg-red-50 rounded-2xl p-3 font-bold">ההזמנה בוטלה. יש שאלה? כתבו לנו בוואטסאפ.</p>
          ) : (
            <StatusTrack status={order.status} />
          )}

          {(order.shipped_at || order.completed_at) && (
            <div className="text-[11px] text-gray-600 space-y-0.5">
              {order.shipped_at && <p>🚚 יצאה למשלוח: {formatDate(order.shipped_at, true)}</p>}
              {order.completed_at && <p>✅ נמסרה: {formatDate(order.completed_at, true)}</p>}
            </div>
          )}

          <div className="divide-y border-t">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-11 h-11 shrink-0 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden p-0.5">
                  {images[i] ? <img src={images[i]} alt="" className="max-w-full max-h-full object-contain" /> : <Icon name="box" size={18} />}
                </span>
                <span className="flex-1 min-w-0 text-xs font-bold text-gray-900">
                  {item.name}
                  {item.qty > 1 && <span className="text-gray-500 font-medium"> × {item.qty}</span>}
                </span>
                <span className="text-xs font-black text-gray-900 shrink-0">{item.gift ? 'מתנה' : formatMoney(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl p-3 text-xs space-y-1">
            {totals.discount > 0 && (
              <div className="flex justify-between text-green-700 font-bold">
                <span>הנחה</span>
                <span>-{formatMoney(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>משלוח{order.city ? ` ל${order.city}` : ''}</span>
              <span>{totals.shipping > 0 ? formatMoney(totals.shipping) : 'חינם'}</span>
            </div>
            <div className="flex justify-between font-black text-sm pt-1 border-t">
              <span>סה״כ</span>
              <span className="text-orange-600">{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <a
            href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, יש לי שאלה על הזמנה מספר ${order.order_number}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center bg-[#25D366]/10 border border-[#25D366]/40 text-[#128C4B] py-3 rounded-2xl text-xs font-black"
          >
            שאלה על ההזמנה? כתבו לנו בוואטסאפ
          </a>
          <button
            type="button"
            onClick={() => {
              setOrder(null);
              setPhone('');
            }}
            className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl text-xs font-black cursor-pointer"
          >
            בדיקת הזמנה אחרת
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={lookup} className="bg-white rounded-3xl border-2 border-orange-100 shadow-sm p-5 sm:p-6 space-y-4">
      <div>
        <label htmlFor="track-num" className="block text-xs font-bold text-gray-700 mb-1">מספר הזמנה</label>
        <input
          id="track-num"
          value={num}
          onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="8 ספרות, למשל 12345678"
          dir="ltr"
          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-orange-500 rounded-2xl p-3 text-sm font-bold text-center tracking-widest outline-none transition"
        />
        <p className="text-[11px] text-gray-400 mt-1">המספר מופיע במייל אישור ההזמנה ובקובץ ה-PDF</p>
      </div>
      <div>
        <label htmlFor="track-phone" className="block text-xs font-bold text-gray-700 mb-1">מספר הטלפון שמסרתם בהזמנה</label>
        <input
          id="track-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="05X-XXXXXXX"
          dir="ltr"
          className="w-full bg-gray-50 border-2 border-gray-100 focus:border-orange-500 rounded-2xl p-3 text-sm font-bold text-center outline-none transition"
        />
      </div>
      {error && <p className="text-xs font-bold text-red-600 bg-red-50 rounded-xl p-3" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white py-3.5 rounded-2xl text-sm font-black transition shadow-md cursor-pointer"
      >
        {busy ? 'בודקים...' : 'איפה ההזמנה שלי?'}
      </button>
      <p className="text-[11px] text-gray-500 text-center">
        נרשמתם לאתר?{' '}
        <Link href="/cart?tab=orders" className="text-orange-700 font-black underline underline-offset-2">
          כל ההזמנות שלכם נמצאות כאן
        </Link>
      </p>
    </form>
  );
}

export default function TrackPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-5" dir="rtl">
      <div className="text-center space-y-1">
        <span className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 inline-flex items-center justify-center">
          <Icon name="truck" size={28} />
        </span>
        <h1 className="text-2xl font-black text-gray-900">מעקב הזמנה</h1>
        <p className="text-xs text-gray-500">בלי להתחבר: מספר הזמנה + טלפון, ורואים איפה ההזמנה</p>
      </div>
      <Suspense fallback={<span className="skeleton h-64 rounded-3xl" />}>
        <TrackContent />
      </Suspense>
    </div>
  );
}
