'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { inRange, isCountedOrder, productSales, revenueOf, startOfDay, startOfMonth, withCosts } from '@/lib/stats';
import { fetchAll } from '@/lib/fetchAll';

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      if (o.error || p.error) console.error('Error fetching admin data:', o.error || p.error);
      setOrders(o.data);
      setProducts(withCosts(p.data, c.data));
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      if (error) {
        alert('שגיאה בעדכון הסטטוס: ' + error.message);
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      console.error(err);
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

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500 font-medium" dir="rtl">
        טוען את נתוני פאנל הניהול...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* כותרת ראשית */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">ברוך הבא לניהול החנות, דניאל 👋</h1>
          <p className="text-xs text-gray-500 mt-1">מערכת הניהול פועלת כשורה. להלן נתוני החנות המעודכנים.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>רענן נתונים</span> 🔄
        </button>
      </div>

      {/* קוביות נתונים */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-orange-600">
          <span className="text-xs font-bold text-gray-500 block">הזמנות חדשות לטיפול</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{newOrders.length}</span>
            <span className="text-xs text-orange-600 font-bold">מתוך {orders.length} סה"כ</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-blue-600">
          <span className="text-xs font-bold text-gray-500 block">הכנסות היום</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">₪{todayRevenue.toLocaleString()}</span>
            <span className="text-xs text-gray-400">{todayOrders.length} הזמנות</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-green-600">
          <span className="text-xs font-bold text-gray-500 block">הכנסות החודש</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-600">₪{monthlyRevenue.toLocaleString()}</span>
            <span className="text-xs text-gray-400">{monthOrders.length} הזמנות</span>
          </div>
          {monthCostedRevenue > 0 && (
            <span className="text-[11px] font-bold text-gray-500 block">
              רווח גולמי (מוצרים עם עלות): ₪{Math.round(monthCostedRevenue - monthCost).toLocaleString()}
            </span>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-red-500">
          <span className="text-xs font-bold text-gray-500 block">מוצרים במלאי נמוך (≤ 3)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-500">{lowStockProducts.length}</span>
            <span className="text-xs text-gray-400">דורש עדכון</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-3">
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

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-3">
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

      {/* הזמנות חדשות */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-black text-base text-gray-900">🚨 הזמנות חדשות שממתינות לטיפול ({newOrders.length})</h3>
          <Link href="/admin/orders" className="text-xs font-bold text-orange-600 hover:underline">
            לכל ההזמנות במערכת ➔
          </Link>
        </div>

        <div className="space-y-3">
          {newOrders.length > 0 ? (
            newOrders.map((ord, idx) => {
              const orderIdStr = String(ord?.id || '');
              const displayId = orderIdStr.length > 8 ? orderIdStr.slice(0, 8) : (orderIdStr || String(idx + 1));
              return (
                <div key={ord?.id || idx} className="bg-orange-50/40 border border-orange-100 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:bg-orange-50/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-gray-900">
                        הזמנה #{displayId} - {ord?.customer_name || ord?.name || 'לקוח'}
                      </span>
                      <span className="text-[10px] bg-orange-200 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                        ממתין לטיפול
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 flex flex-wrap gap-3">
                      <span>📞 טלפון: <strong className="text-gray-800">{ord?.phone || ord?.customer_phone || 'לא צוין'}</strong></span>
                      <span>📍 כתובת/סניף: <strong className="text-gray-800">{ord?.address || ord?.city || 'איסוף/משלוח'}</strong></span>
                      <span>📅 תאריך: <strong className="text-gray-800">{ord?.created_at ? new Date(ord.created_at).toLocaleString('he-IL') : 'היום'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                    <span className="text-base font-black text-orange-600">₪{ord?.total_price || ord?.price || 0}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleStatusChange(ord.id, 'הושלם')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        סמן כהושלם ✓
                      </button>
                      <button 
                        onClick={() => handleStatusChange(ord.id, 'בטיפול')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        העבר לטיפול ⏳
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="text-xs font-bold text-gray-600">כל הכבוד! אין הזמנות חדשות שממתינות לטיפול כרגע.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
