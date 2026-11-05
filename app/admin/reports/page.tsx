'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { downloadCsv } from '@/lib/csv';
import { Order, orderTotals } from '@/lib/orders';
import { addDays, isCountedOrder, orderDate, productSales, revenueOf, startOfDay, withCosts } from '@/lib/stats';
import { fetchAll } from '@/lib/fetchAll';
import { showToast } from '@/lib/toast';

const PERIODS = [
  { key: 'week', label: 'שבוע', days: 7 },
  { key: 'month', label: 'חודש', days: 30 },
  { key: 'quarter', label: 'רבעון', days: 90 },
  { key: 'year', label: 'שנה', days: 365 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

const money = (n: number) => `₪${Math.round(n).toLocaleString()}`;

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('month');

  useEffect(() => {
    (async () => {
      const [o, p, c] = await Promise.all([
        fetchAll((a, b) => supabase.from('orders').select('*').order('created_at', { ascending: true }).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('products').select('*').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('product_costs').select('product_id, cost').order('product_id').range(a, b)),
      ]);
      if (o.error || p.error) showToast('חלק מהנתונים לא נטענו, נסו לרענן', { kind: 'error' });
      setOrders(o.data as Order[]);
      setProducts(withCosts(p.data, c.data));
      setLoading(false);
    })();
  }, []);

  const report = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)!.days;
    const to = new Date();
    const from = addDays(startOfDay(to), -(days - 1));
    const inPeriod = orders.filter((o) => {
      const d = orderDate(o);
      return !!d && d >= from && d <= to;
    });
    const counted = inPeriod.filter(isCountedOrder);
    const revenue = revenueOf(counted);

    // לקוח חדש: ההזמנה הראשונה שלו (לפי מייל או טלפון) נמצאת בתקופה
    const firstSeen = new Map<string, number>();
    for (const o of orders.filter(isCountedOrder)) {
      const key = String(o.email || o.phone || o.customer_phone || '').trim().toLowerCase();
      const d = orderDate(o);
      if (!key || !d) continue;
      if (!firstSeen.has(key) || d.getTime() < firstSeen.get(key)!) firstSeen.set(key, d.getTime());
    }
    const newCustomers = Array.from(firstSeen.values()).filter((t) => t >= from.getTime() && t <= to.getTime()).length;

    // גרף יומי
    const daily: { label: string; value: number }[] = [];
    for (let i = 0; i < days; i++) {
      const dayStart = addDays(from, i);
      const dayEnd = addDays(from, i + 1);
      const value = counted
        .filter((o) => {
          const d = orderDate(o)!;
          return d >= dayStart && d < dayEnd;
        })
        .reduce((s, o) => s + orderTotals(o).total, 0);
      daily.push({ label: dayStart.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }), value });
    }

    const sales = productSales(counted, products);
    const costed = sales.filter((r) => r.hasCost);
    return {
      from,
      to,
      orders: counted.length,
      cancelled: inPeriod.length - counted.length,
      revenue,
      average: counted.length ? revenue / counted.length : 0,
      newCustomers,
      daily,
      top: sales.filter((r) => r.qty > 0).slice(0, 10),
      profit: costed.reduce((s, r) => s + r.revenue - r.cost, 0),
      hasCosts: costed.length > 0,
    };
  }, [orders, products, period]);

  if (loading) {
    return <div className="text-center py-20 text-gray-500 font-medium" dir="rtl">טוען דוחות...</div>;
  }

  const maxDay = Math.max(1, ...report.daily.map((d) => d.value));
  const cards = [
    { label: 'הכנסות', value: money(report.revenue), color: 'text-green-600' },
    { label: 'הזמנות', value: report.orders, color: 'text-gray-900', note: report.cancelled ? `${report.cancelled} בוטלו` : '' },
    { label: 'ממוצע להזמנה', value: money(report.average), color: 'text-blue-600' },
    { label: 'לקוחות חדשים', value: report.newCustomers, color: 'text-orange-600' },
  ];

  const exportCsv = () =>
    downloadCsv(`report-${period}.csv`, [
      ['תקופה', `${report.from.toLocaleDateString('he-IL')} - ${report.to.toLocaleDateString('he-IL')}`],
      ['הכנסות', Math.round(report.revenue)],
      ['הזמנות', report.orders],
      ['ממוצע להזמנה', Math.round(report.average)],
      ['לקוחות חדשים', report.newCustomers],
      [],
      ['מוצר', 'כמות', 'הכנסה', 'רווח גולמי'],
      ...report.top.map((r) => [r.name, r.qty, Math.round(r.revenue), r.hasCost ? Math.round(r.revenue - r.cost) : '']),
    ]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">📊 דוחות מכירות</h1>
          <p className="text-xs text-gray-500 mt-1">
            {report.from.toLocaleDateString('he-IL')} – {report.to.toLocaleDateString('he-IL')} · הזמנות שבוטלו לא נספרות
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === p.key ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button onClick={exportCsv} className="px-4 py-2 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white cursor-pointer">
            ייצוא לאקסל ⬇
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-5 rounded-3xl border shadow-sm space-y-1">
            <span className="text-xs font-bold text-gray-500 block">{c.label}</span>
            <span className={`text-2xl font-black ${c.color}`}>{c.value}</span>
            {c.note && <span className="text-[11px] text-gray-400 block">{c.note}</span>}
          </div>
        ))}
      </div>

      {report.hasCosts && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm font-bold text-green-800">
          רווח גולמי בתקופה (רק מוצרים שהוגדרה להם עלות): {money(report.profit)}
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <h3 className="font-black text-base text-gray-900">הכנסות לפי יום</h3>
        <div className="flex items-end gap-[2px] h-40" dir="ltr">
          {report.daily.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
              <div
                className="bg-orange-500 group-hover:bg-orange-600 rounded-t transition min-h-[2px]"
                style={{ height: `${(d.value / maxDay) * 100}%` }}
                title={`${d.label}: ${money(d.value)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400" dir="ltr">
          <span>{report.daily[0]?.label}</span>
          <span>{report.daily[report.daily.length - 1]?.label}</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
        <h3 className="font-black text-base text-gray-900">🏆 10 המוצרים המובילים</h3>
        {report.top.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-right py-2">#</th>
                  <th className="text-right py-2">מוצר</th>
                  <th className="text-right py-2">כמות</th>
                  <th className="text-right py-2">הכנסה</th>
                  <th className="text-right py-2">רווח גולמי</th>
                </tr>
              </thead>
              <tbody>
                {report.top.map((r, i) => (
                  <tr key={r.name + i} className="border-b last:border-0">
                    <td className="py-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 font-bold text-gray-800">{r.name}</td>
                    <td className="py-2">{r.qty}</td>
                    <td className="py-2">{money(r.revenue)}</td>
                    <td className="py-2 text-gray-500">{r.hasCost ? money(r.revenue - r.cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500">אין מכירות בתקופה הזו.</p>
        )}
      </div>
    </div>
  );
}
