'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { inRange, isCountedOrder, productSales, revenueOf, startOfDay, startOfMonth, withCosts } from '@/lib/stats';
import { fetchAll } from '@/lib/fetchAll';
import { formatDate, orderNumber } from '@/lib/orders';
import { LoadErrorBox } from '@/components/admin/LoadErrorBox';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState<any>(null);

  // עכשיו באתר: מתרענן כל 30 שניות
  useEffect(() => {
    const load = () => supabase.rpc('admin_live').then(({ data }) => data && setLive(data));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [o, p, c] = await Promise.all([
        fetchAll((a, b) => supabase.from('orders').select('*').order('created_at', { ascending: false }).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('products').select('*').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('product_costs').select('product_id, cost').order('product_id').range(a, b)),
      ]);
      // נתונים חלקיים יציגו סכומים נמוכים מהאמת, ולכן במקרה של שגיאה לא מציגים אותם
      const failed = o.error || p.error || c.error;
      setLoadError(failed ? failed.message || 'שגיאה בטעינה' : '');
      if (!failed) {
        setOrders(o.data);
        setProducts(withCosts(p.data, c.data));
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };


  const now = new Date();
  const counted = orders.filter(isCountedOrder);
  const monthOrders = counted.filter((o) => inRange(o, startOfMonth(now), new Date(8640000000000000)));
  const todayOrders = counted.filter((o) => inRange(o, startOfDay(now), new Date(8640000000000000)));
  const monthlyRevenue = revenueOf(monthOrders);
  const todayRevenue = revenueOf(todayOrders);
  const monthSales = productSales(monthOrders, products);
  const monthCost = monthSales.reduce((sum, r) => sum + r.cost, 0);
  const monthCostedRevenue = monthSales.filter((r) => r.hasCost).reduce((sum, r) => sum + r.revenue, 0);
  const topSellers = productSales(orders, products).filter((r) => r.qty > 0).slice(0, 5);

  // מלאי נמוך: רק מוצרים שהוגדר להם מלאי
  const lowStockProducts = products
    .filter((p) => p && p.stock !== null && p.stock !== undefined && p.stock !== '' && Number(p.stock) <= 3)
    .sort((a, b) => Number(a.stock) - Number(b.stock));
  const newOrders = orders.filter(o => o && (o.status === 'חדש' || !o.status || o.status === 'pending'));

  if (!loading && loadError) return <LoadErrorBox error={loadError} what="נתוני פאנל הניהול" onRetry={fetchDashboardData} />;

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500 font-medium" dir="rtl">
        טוען את נתוני פאנל הניהול...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-gray-900">לוח בקרה</h1>
        <button
          onClick={fetchDashboardData}
          className="text-xs font-bold text-orange-700 bg-white border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-xl cursor-pointer"
        >
          🔄 רענון
        </button>
      </div>

      {/* עכשיו באתר */}
      <Link href="/admin/analytics" className="flex items-center justify-between gap-3 bg-green-50 border-2 border-green-300 rounded-2xl p-4 hover:bg-green-100/70 transition">
        <span className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-600" />
          </span>
          <span>
            <span className="block text-sm font-black text-green-900">{live ? (live.online || []).length : '…'} גולשים באתר עכשיו</span>
            <span className="block text-[11px] text-green-800/70">
              {live ? `${live.today_visitors || 0} מבקרים היום · ${(live.open_carts || []).length} עגלות פתוחות` : 'טוען...'}
            </span>
          </span>
        </span>
        <span className="text-xs font-black text-green-800">לסטטיסטיקה המלאה ←</span>
      </Link>

      {/* קוביות נתונים */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'הכנסות היום', value: `₪${Math.round(todayRevenue).toLocaleString()}`, sub: `${todayOrders.length} הזמנות`, href: '/admin/reports', color: 'text-blue-700' },
          { label: 'הכנסות החודש', value: `₪${Math.round(monthlyRevenue).toLocaleString()}`, sub: monthCostedRevenue > 0 ? `רווח גולמי ₪${Math.round(monthCostedRevenue - monthCost).toLocaleString()}` : `${monthOrders.length} הזמנות`, href: '/admin/reports', color: 'text-green-700' },
          { label: 'ממתינות לטיפול', value: String(newOrders.length), sub: `מתוך ${orders.length} הזמנות`, href: '/admin/orders', color: 'text-purple-700' },
          { label: 'מלאי נמוך', value: String(lowStockProducts.length), sub: lowStockProducts.length ? 'מוצרים לעדכון' : 'הכל תקין', href: '/admin/products/quick-edit', color: 'text-red-600' },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="bg-orange-100 rounded-2xl border-2 border-orange-300 shadow-sm p-4 min-w-0 hover:bg-orange-200/70 transition">
            <span className="block text-[11px] font-bold text-orange-900 truncate">{c.label}</span>
            <span className={`block text-2xl font-black mt-1 truncate tabular-nums ${c.color}`}>{c.value}</span>
            <span className="block text-[11px] text-orange-800/80 mt-0.5 truncate">{c.sub}</span>
          </Link>
        ))}
      </div>

      {/* הזמנות חדשות: רשימה קצרה, לחיצה פותחת את ההזמנה במסך ההזמנות */}
      <div className="bg-white p-5 rounded-3xl border-2 border-orange-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-base text-gray-900">🆕 הזמנות חדשות ({newOrders.length})</h3>
          <Link href="/admin/orders" className="text-xs font-bold text-orange-600 hover:underline">כל ההזמנות ←</Link>
        </div>
        {newOrders.length > 0 ? (
          <ul className="divide-y divide-orange-100">
            {newOrders.map((ord) => (
              <li key={ord.id}>
                <Link
                  href={`/admin/orders?q=${orderNumber(ord.id)}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-orange-50/50 -mx-2 px-2 rounded-xl"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-gray-900 truncate">{ord.customer_name || 'לקוח'}</span>
                    <span className="block text-[11px] text-gray-500">
                      #{orderNumber(ord.id)} · {formatDate(ord.created_at, true)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black text-orange-600">₪{Math.round(Number(ord.total_price || ord.total || 0)).toLocaleString()}</span>
                    <span className="text-gray-300">‹</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500 py-4 text-center">אין הזמנות חדשות שממתינות לטיפול 🎉</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border-2 border-orange-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-orange-100 pb-3">
            <h3 className="font-black text-base text-gray-900">🏆 הנמכרים ביותר</h3>
            <Link href="/admin/reports" className="text-xs font-bold text-orange-600 hover:underline">לדוחות ➔</Link>
          </div>
          {topSellers.length ? (
            <ol className="space-y-2">
              {topSellers.map((row, i) => (
                <li key={row.name + i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-orange-50 text-orange-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                    <span className="font-bold text-gray-800 truncate">{row.name}</span>
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{row.qty} יח׳ · ₪{Math.round(row.revenue).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-gray-500">עדיין אין מכירות.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border-2 border-orange-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b border-orange-100 pb-3">
            <h3 className="font-black text-base text-gray-900">📉 מלאי נמוך</h3>
            <Link href="/admin/products" className="text-xs font-bold text-orange-600 hover:underline">לניהול מוצרים ➔</Link>
          </div>
          {lowStockProducts.length ? (
            <ul className="space-y-2">
              {lowStockProducts.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-gray-800 truncate">{p.name}</span>
                  <span className={`text-xs font-black shrink-0 px-2 py-0.5 rounded-full ${Number(p.stock) <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                    {Number(p.stock) <= 0 ? 'אזל' : `נשארו ${p.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">כל המוצרים במלאי תקין.</p>
          )}
        </div>
      </div>

    </div>
  );
}
