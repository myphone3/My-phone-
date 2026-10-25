'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Order,
  ORDER_STEPS,
  formatDate,
  formatMoney,
  orderItems,
  orderNumber,
  orderStepIndex,
  orderTotals,
  statusBadge,
} from '@/lib/orders';

// תמונה של המוצר הראשון בהזמנה
function firstImage(order: Order) {
  const item: any = Array.isArray(order.items) ? order.items[0] : null;
  if (!item) return '';
  return item.image || item.image_url || (Array.isArray(item.images) ? item.images[0] : '') || '';
}

export async function downloadOrderPdf(order: Order) {
  const { buildOrderPdf, loadPdfAssets } = await import('@/lib/orderPdf');
  const bytes = await buildOrderPdf(order, await loadPdfAssets());
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `order-${orderNumber(order.id)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusTrack({ status }: { status?: string | null }) {
  if (status === 'מבוטל') return null;
  const current = orderStepIndex(status);
  return (
    <div>
      <div className="flex items-center">
        {ORDER_STEPS.map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <div className={`flex-1 h-[3px] ${i <= current ? 'bg-orange-600' : 'bg-gray-200'}`} />}
            <div
              className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] text-white shrink-0 ${
                i <= current ? 'bg-orange-600' : 'bg-gray-200'
              }`}
            >
              {i <= current ? '✓' : ''}
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        {ORDER_STEPS.map((step, i) => (
          <span key={step} className={i === current ? 'text-orange-700 font-black' : ''}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const badge = statusBadge(order.status);
  const totals = orderTotals(order);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadOrderPdf(order);
    } catch (err) {
      console.error(err);
      alert('לא הצלחנו ליצור את קובץ ה-PDF, נסו שוב.');
    }
    setDownloading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onClose} dir="rtl">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <b className="text-base font-black" dir="ltr">הזמנה #{orderNumber(order.id)}</b>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-black text-sm cursor-pointer"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className={`font-bold px-2.5 py-1 rounded-full ${badge.className}`}>{badge.label}</span>
          <span>{formatDate(order.created_at, true)}</span>
        </div>

        <div className="text-xs font-black text-gray-500 pt-1">מוצרים</div>
        <div className="bg-gray-50 rounded-2xl p-3 text-sm space-y-1.5">
          {orderItems(order).map((item, i) => (
            <div key={i} className="flex justify-between gap-3">
              <span>
                {item.name} × {item.qty}
              </span>
              <span className="whitespace-nowrap">{item.gift ? 'חינם' : formatMoney(item.total)}</span>
            </div>
          ))}
          {totals.discount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>הנחה</span>
              <span>-{formatMoney(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>משלוח</span>
            <span>{totals.shipping > 0 ? formatMoney(totals.shipping) : 'חינם'}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-1 font-black text-orange-600">
            <span>סה״כ</span>
            <span>{formatMoney(totals.total)}</span>
          </div>
        </div>

        <div className="text-xs font-black text-gray-500 pt-1">משלוח אל</div>
        <div className="bg-gray-50 rounded-2xl p-3 text-sm leading-relaxed">
          {[order.customer_name, order.phone || order.customer_phone].filter(Boolean).join(' · ')}
          <br />
          {order.address || order.customer_address}
          {order.notes && <span className="block text-gray-500 text-xs mt-1">הערות: {order.notes}</span>}
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-sm font-black transition cursor-pointer disabled:opacity-60"
        >
          {downloading ? 'מכין קובץ...' : '⬇ הורדת סיכום PDF'}
        </button>
      </div>
    </div>
  );
}

export default function MyOrders() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      // לקוח רואה רק את ההזמנות שלו (גם לפי הרשאות בבסיס הנתונים). הסינון כאן הוא בשביל מנהלים, שרואים הכול
      const { data } = await supabase
        .from('orders')
        .select('*')
        .ilike('email', email)
        .order('created_at', { ascending: false });
      setOrders((data as Order[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (loading) {
    return <div className="text-center py-16 text-gray-500 text-sm font-medium">טוען הזמנות...</div>;
  }

  if (!loggedIn) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border p-8 space-y-4 shadow-sm">
        <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto text-3xl">📦</div>
        <h2 className="text-lg font-black text-gray-900">כדי לראות את ההזמנות שלך יש להירשם לאתר</h2>
        <button
          type="button"
          onClick={handleLogin}
          className="inline-block bg-orange-600 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-orange-700 transition shadow-sm cursor-pointer"
        >
          הרשמה לאתר עם Google
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border p-8 space-y-4 shadow-sm">
        <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto text-3xl">📦</div>
        <h2 className="text-lg font-black text-gray-900">עדיין אין לך הזמנות</h2>
        <Link href="/" className="inline-block bg-orange-600 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-orange-700 transition shadow-sm">
          🏠 למעבר לקטלוג
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 font-medium">{orders.length === 1 ? 'הזמנה אחת' : `${orders.length} הזמנות`}</p>
      {orders.map((order) => {
        const badge = statusBadge(order.status);
        const items = orderItems(order);
        const image = firstImage(order);
        return (
          <div key={order.id} className="bg-white rounded-3xl border shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <b className="text-sm font-black" dir="ltr">#{orderNumber(order.id)}</b>
                <span className="block text-[11px] text-gray-500">{formatDate(order.created_at)}</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.className}`}>{badge.label}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gray-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                {image ? <img src={image} alt="" className="w-full h-full object-contain" /> : <span>📱</span>}
              </div>
              <div className="text-xs text-gray-700 flex-1 line-clamp-2">
                {items.map((i) => i.name).join(' + ')}
              </div>
              <div className="text-sm font-black text-orange-600 whitespace-nowrap">{formatMoney(orderTotals(order).total)}</div>
            </div>

            <StatusTrack status={order.status} />

            <button
              type="button"
              onClick={() => setSelected(order)}
              className="bg-white border-2 border-orange-300 text-orange-700 hover:bg-orange-50 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer"
            >
              📄 פרטי ההזמנה
            </button>
          </div>
        );
      })}

      {selected && <OrderDetails order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
