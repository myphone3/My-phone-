'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetchAll';
import { addDays, isCountedOrder, orderDate, productSales, startOfDay, withCosts } from '@/lib/stats';
import { orderTotals } from '@/lib/orders';

// רכיבים למסך הסטטיסטיקה: סיכום יומי/שבועי, גרף פעילות לאורך זמן, הנמכרים ביותר והזמנות לפי ימים ושעות

const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => n(v).toLocaleString('he-IL');
const money = (v: any) => `₪${Math.round(n(v)).toLocaleString('he-IL')}`;
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// שינוי באחוזים מול התקופה הקודמת
export function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return null;
  if (!before) return <span className="text-[10px] font-black text-green-700">חדש ↑</span>;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-[10px] font-bold text-gray-400">ללא שינוי</span>;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={`text-[10px] font-black ${good ? 'text-green-700' : 'text-red-600'}`} title="לעומת התקופה הקודמת">
      {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
    </span>
  );
}

export function CompareTile({ label, value, now, before, invert, sub }: { label: string; value: string; now: number; before?: number; invert?: boolean; sub?: string }) {
  return (
    <div className="bg-orange-50 rounded-2xl border border-orange-200 p-3 min-w-0">
      <span className="block text-[11px] font-bold text-orange-900 truncate">{label}</span>
      <span className="block text-xl sm:text-2xl font-black mt-0.5 tabular-nums truncate text-gray-900">{value}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-orange-800/70 truncate">
        {before !== undefined && <Delta now={now} before={before} invert={invert} />}
        {sub}
      </span>
    </div>
  );
}

// ===== סיכום: אתמול והשבוע האחרון, מול התקופה שלפני =====
async function analytics(from: Date, to: Date) {
  const { data } = await supabase.rpc('admin_analytics', { p_from: from.toISOString(), p_to: to.toISOString() });
  return data as any;
}

function SummaryBlock({ title, cur, prev, compareLabel }: { title: string; cur: any; prev: any; compareLabel: string }) {
  const k = cur?.kpis || {};
  const p = prev?.kpis || {};
  const conv = (x: any) => (n(x.sessions) ? (n(x.orders) / n(x.sessions)) * 100 : 0);
  const topViewed = [...(cur?.products || [])].sort((a, b) => n(b.views) - n(a.views)).slice(0, 5);
  const topSold = [...(cur?.products || [])].filter((x) => n(x.sold) > 0).sort((a, b) => n(b.sold) - n(a.sold)).slice(0, 5);
  const zero = (cur?.searches || []).filter((s: any) => n(s.results) === 0).slice(0, 6);
  return (
    <section className="bg-white p-4 sm:p-5 rounded-3xl border-2 border-orange-100 shadow-sm space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-black text-base text-gray-900">{title}</h3>
        <span className="text-[10px] text-gray-400">החצים: לעומת {compareLabel}</span>
      </div>
      {!cur ? (
        <p className="text-xs text-gray-400 py-6 text-center">טוען...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <CompareTile label="מבקרים" value={fmt(k.visitors)} now={n(k.visitors)} before={n(p.visitors)} />
            <CompareTile label="הזמנות" value={fmt(k.orders)} now={n(k.orders)} before={n(p.orders)} />
            <CompareTile label="הכנסות" value={money(k.revenue)} now={n(k.revenue)} before={n(p.revenue)} />
            <CompareTile label="אחוז המרה" value={`${conv(k).toFixed(1)}%`} now={conv(k)} before={conv(p)} />
            <CompareTile label="צפיות בעמודים" value={fmt(k.page_views)} now={n(k.page_views)} before={n(p.page_views)} />
            <CompareTile label="צפיות במוצרים" value={fmt(k.product_views)} now={n(k.product_views)} before={n(p.product_views)} />
            <CompareTile label="הוספות לעגלה" value={fmt(k.add_to_cart)} now={n(k.add_to_cart)} before={n(p.add_to_cart)} />
            <CompareTile label="יצאו אחרי עמוד אחד" value={`${fmt(k.bounce)}%`} now={n(k.bounce)} before={n(p.bounce)} invert />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
              <b className="block text-gray-900">🏆 הכי נמכרים</b>
              {topSold.length ? (
                topSold.map((x: any, i: number) => (
                  <div key={x.id} className="flex justify-between gap-2">
                    <span className="truncate" dir="auto">
                      {i + 1}. {x.name}
                    </span>
                    <span className="font-black shrink-0">{fmt(x.sold)} יח׳</span>
                  </div>
                ))
              ) : (
                <span className="text-gray-400">אין מכירות בתקופה</span>
              )}
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
              <b className="block text-gray-900">👀 הכי נצפים</b>
              {topViewed.length ? (
                topViewed.map((x: any, i: number) => (
                  <div key={x.id} className="flex justify-between gap-2">
                    <span className="truncate" dir="auto">
                      {i + 1}. {x.name}
                    </span>
                    <span className="font-black shrink-0">{fmt(x.views)}</span>
                  </div>
                ))
              ) : (
                <span className="text-gray-400">אין צפיות בתקופה</span>
              )}
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
              <b className="block text-gray-900">❌ חיפשו ולא מצאו</b>
              {zero.length ? (
                zero.map((s: any) => (
                  <div key={s.query} className="flex justify-between gap-2">
                    <span className="truncate">&quot;{s.query}&quot;</span>
                    <span className="font-black shrink-0">{fmt(s.n)}</span>
                  </div>
                ))
              ) : (
                <span className="text-gray-400">כל החיפושים מצאו תוצאות 🎉</span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function SummaryPanel() {
  const [blocks, setBlocks] = useState<{ y?: any; yPrev?: any; w?: any; wPrev?: any }>({});
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const today = startOfDay(new Date());
    (async () => {
      const [y, yPrev, w, wPrev] = await Promise.all([
        analytics(addDays(today, -1), today),
        analytics(addDays(today, -2), addDays(today, -1)),
        analytics(addDays(today, -6), addDays(today, 1)),
        analytics(addDays(today, -13), addDays(today, -6)),
      ]);
      setBlocks({ y, yPrev, w, wPrev });
    })();
    supabase
      .from('products')
      .select('id, name, stock')
      .not('stock', 'is', null)
      .lte('stock', 3)
      .order('stock')
      .then(({ data }) => setLowStock(data || []));
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or('status.is.null,status.eq.חדש,status.eq.pending')
      .then(({ count }) => setPending(count ?? 0));
  }, []);

  const yName = DAYS[addDays(startOfDay(new Date()), -1).getDay()];

  return (
    <div className="space-y-4">
      {(pending || lowStock.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pending ? (
            <Link href="/admin/orders" className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-3 text-xs">
              <b className="block text-purple-900 text-sm">📋 {pending} הזמנות ממתינות לטיפול</b>
              <span className="text-purple-800/70">למסך ההזמנות ←</span>
            </Link>
          ) : null}
          {lowStock.length > 0 && (
            <Link href="/admin/products/quick-edit" className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 text-xs">
              <b className="block text-red-900 text-sm">📉 {lowStock.length} מוצרים במלאי נמוך</b>
              <span className="text-red-800/70 line-clamp-1">{lowStock.map((p) => `${p.name} (${p.stock})`).join(' · ')}</span>
            </Link>
          )}
        </div>
      )}
      <SummaryBlock title={`📅 אתמול (יום ${yName})`} cur={blocks.y} prev={blocks.yPrev} compareLabel="שלשום" />
      <SummaryBlock title="🗓️ 7 הימים האחרונים" cur={blocks.w} prev={blocks.wPrev} compareLabel="7 הימים שלפני" />
    </div>
  );
}

// ===== גרף פעילות לאורך זמן: לפי שעה / יום / שבוע / חודש =====
export type Bucket = 'hour' | 'day' | 'week' | 'month';
const BUCKETS: { key: Bucket; label: string; seconds: number }[] = [
  { key: 'hour', label: 'שעה', seconds: 3600 },
  { key: 'day', label: 'יום', seconds: 86400 },
  { key: 'week', label: 'שבוע', seconds: 7 * 86400 },
  { key: 'month', label: 'חודש', seconds: 30 * 86400 },
];
const METRICS = [
  { key: 'visitors', label: 'מבקרים', format: fmt },
  { key: 'views', label: 'צפיות', format: fmt },
  { key: 'product_views', label: 'צפיות במוצרים', format: fmt },
  { key: 'carts', label: 'הוספות לעגלה', format: fmt },
  { key: 'orders', label: 'הזמנות', format: fmt },
  { key: 'revenue', label: 'הכנסות', format: money },
] as const;

export function defaultBucket(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days <= 2) return 'hour';
  if (days <= 62) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

function bucketLabel(start: string, bucket: Bucket) {
  const [date, time] = start.split('T');
  const [y, m, d] = date.split('-').map(Number);
  if (bucket === 'hour') return `${d}.${m} ${time}`;
  if (bucket === 'day') return `יום ${DAYS[new Date(y, m - 1, d).getDay()].charAt(0)}׳ ${d}.${m}`;
  if (bucket === 'week') return `שבוע מ-${d}.${m}`;
  return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

export function TrendChart({ from, to }: { from: Date; to: Date }) {
  const [bucket, setBucket] = useState<Bucket>(defaultBucket(from, to));
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('visitors');
  const [rows, setRows] = useState<any[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState('');
  const seconds = (to.getTime() - from.getTime()) / 1000;

  useEffect(() => {
    setBucket(defaultBucket(from, to));
  }, [from, to]);

  useEffect(() => {
    setRows(null);
    setHover(null);
    supabase.rpc('admin_timeseries', { p_from: from.toISOString(), p_to: to.toISOString(), p_bucket: bucket }).then(({ data, error: e }) => {
      setError(e ? e.message : '');
      setRows((data as any[]) || []);
    });
  }, [from, to, bucket]);

  const m = METRICS.find((x) => x.key === metric)!;
  const values = (rows || []).map((r) => n(r[metric]));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const bestIdx = values.indexOf(Math.max(...values, 0));
  const h = hover !== null && rows ? rows[hover] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold text-gray-500">לפי:</span>
        {BUCKETS.map((b) => {
          const disabled = seconds / b.seconds > 400 || (b.key !== 'hour' && seconds / b.seconds < 1);
          return (
            <button
              key={b.key}
              disabled={disabled}
              onClick={() => setBucket(b.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                bucket === b.key ? 'bg-gray-900 text-white' : 'bg-gray-50 border text-gray-600'
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {METRICS.map((x) => (
          <button
            key={x.key}
            onClick={() => setMetric(x.key)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${metric === x.key ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-800'}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : rows === null ? (
        <p className="text-xs text-gray-400 py-10 text-center">טוען...</p>
      ) : (
        <>
          <div className="h-6 text-xs text-gray-700 font-bold truncate">
            {h ? `${bucketLabel(h.start, bucket)}: ${m.format(h[metric])} ${m.label}` : `סה"כ בתקופה: ${m.format(total)} · שיא: ${rows[bestIdx] ? bucketLabel(rows[bestIdx].start, bucket) : ''}`}
          </div>
          <div className="flex items-end gap-[2px] h-40 border-b border-gray-200" dir="ltr" onMouseLeave={() => setHover(null)}>
            {rows.map((r, i) => (
              <button
                key={r.start}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${bucketLabel(r.start, bucket)}: ${m.format(r[metric])}`}
                className="flex-1 h-full flex items-end cursor-pointer min-w-[2px]"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition ${hover === i ? 'bg-orange-700' : 'bg-orange-500'}`}
                  style={{ height: `${values[i] ? Math.max(3, (values[i] / max) * 100) : 0}%` }}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400" dir="ltr">
            <span>{rows[0] ? bucketLabel(rows[0].start, bucket) : ''}</span>
            <span>{rows.length ? bucketLabel(rows[rows.length - 1].start, bucket) : ''}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ===== מכירות בתקופה: הנמכרים ביותר (כמות, הכנסה, רווח) והזמנות לפי ימים בשבוע ושעות =====
export function useOrdersInRange(from: Date, to: Date) {
  const [state, setState] = useState<{ orders: any[]; products: any[] } | null>(null);
  useEffect(() => {
    setState(null);
    (async () => {
      const [o, p, c] = await Promise.all([
        fetchAll((a, b) => supabase.from('orders').select('*').gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('products').select('*').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('product_costs').select('product_id, cost').order('product_id').range(a, b)),
      ]);
      setState({ orders: (o.data || []).filter(isCountedOrder), products: withCosts(p.data || [], c.data || []) });
    })();
  }, [from, to]);
  return state;
}

export function BestSellers({ from, to }: { from: Date; to: Date }) {
  const state = useOrdersInRange(from, to);
  const [sort, setSort] = useState<'qty' | 'revenue' | 'profit'>('qty');
  const rows = useMemo(() => {
    if (!state) return null;
    return productSales(state.orders, state.products)
      .map((r) => ({ ...r, profit: r.hasCost ? r.revenue - r.cost : null }))
      .filter((r) => r.qty > 0)
      .sort((a, b) => n((b as any)[sort]) - n((a as any)[sort]));
  }, [state, sort]);
  const max = Math.max(1, ...(rows || []).map((r) => n((r as any)[sort])));

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {[
          ['qty', 'לפי כמות'],
          ['revenue', 'לפי הכנסה'],
          ['profit', 'לפי רווח'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setSort(k as any)} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${sort === k ? 'bg-gray-900 text-white' : 'bg-gray-50 border text-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="text-xs text-gray-400 py-6 text-center">טוען...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">אין מכירות בתקופה הזו</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.slice(0, 15).map((r, i) => (
            <li key={r.name + i} className="text-xs">
              <div className="flex justify-between gap-2 mb-1">
                <span className="font-bold text-gray-800 truncate" dir="auto">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {r.name}
                </span>
                <span className="text-gray-600 tabular-nums shrink-0">
                  <b className="text-gray-900">{fmt(r.qty)} יח׳</b> · {money(r.revenue)}
                  {r.profit !== null ? ` · רווח ${money(r.profit)}` : ''}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.max(2, (n((r as any)[sort]) / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {sort === 'profit' && <p className="text-[10px] text-gray-400">רווח מחושב רק למוצרים שהוגדרה להם עלות (במסך מוצרים).</p>}
    </div>
  );
}

export function OrdersByTime({ from, to }: { from: Date; to: Date }) {
  const state = useOrdersInRange(from, to);
  const data = useMemo(() => {
    const days = DAYS.map(() => ({ orders: 0, revenue: 0 }));
    const hours = Array.from({ length: 24 }, () => ({ orders: 0, revenue: 0 }));
    for (const o of state?.orders || []) {
      const d = orderDate(o);
      if (!d) continue;
      const total = orderTotals(o).total;
      // שעון ישראל
      const il = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      days[il.getDay()].orders++;
      days[il.getDay()].revenue += total;
      hours[il.getHours()].orders++;
      hours[il.getHours()].revenue += total;
    }
    return { days, hours };
  }, [state]);
  if (!state) return <p className="text-xs text-gray-400 py-6 text-center">טוען...</p>;
  if (!state.orders.length) return <p className="text-xs text-gray-400 py-6 text-center">אין הזמנות בתקופה הזו</p>;
  const maxDay = Math.max(1, ...data.days.map((d) => d.revenue));
  const maxHour = Math.max(1, ...data.hours.map((h) => h.orders));
  const bestDay = data.days.indexOf(data.days.reduce((a, b) => (b.revenue > a.revenue ? b : a)));
  return (
    <div className="space-y-4">
      <p className="text-xs bg-green-50 border border-green-100 rounded-xl p-2.5 text-green-900">
        💡 היום הכי חזק במכירות: <b>יום {DAYS[bestDay]}</b> ({money(data.days[bestDay].revenue)})
      </p>
      <ul className="space-y-2">
        {data.days.map((d, i) => (
          <li key={i} className="text-xs" title={`יום ${DAYS[i]}: ${d.orders} הזמנות, ${money(d.revenue)}`}>
            <div className="flex justify-between mb-1">
              <span className="font-bold text-gray-800">יום {DAYS[i]}</span>
              <span className="text-gray-600 tabular-nums">
                {fmt(d.orders)} הזמנות · {money(d.revenue)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-600 rounded-full" style={{ width: `${d.revenue ? Math.max(2, (d.revenue / maxDay) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div>
        <span className="block text-[11px] font-bold text-gray-500 mb-1">הזמנות לפי שעה ביום</span>
        <div className="flex items-end gap-[2px] h-20 border-b border-gray-200" dir="ltr">
          {data.hours.map((h, i) => (
            <span key={i} className="flex-1 flex items-end h-full" title={`${i}:00 · ${h.orders} הזמנות · ${money(h.revenue)}`}>
              <span className="block w-full bg-green-600 rounded-t-[3px]" style={{ height: `${h.orders ? Math.max(4, (h.orders / maxHour) * 100) : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400" dir="ltr">
          <span>0:00</span>
          <span>12:00</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  );
}
