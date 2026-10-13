'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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
      const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      const { data: productsData } = await supabase.from('products').select('*');
      
      if (ordersData) setOrders(ordersData);
      if (productsData) setProducts(productsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      alert('שגיאה בעדכון הסטטוס: ' + error.message);
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyRevenue = orders
    .filter(o => {
      if (!o || (!o.created_at && !o.date)) return false;
      const orderDate = new Date(o.created_at || o.date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    })
    .reduce((sum, o) => sum + (Number(o.total_price || o.price || o.amount) || 0), 0);

  const lowStockProducts = products.filter(p => p && (Number(p.stock) || 0) <= 3);
  const newOrders = orders.filter(o => o && (o.status === 'חדש' || !o.status || o.status === 'pending'));

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען נתוני דף הבית...</div>;

  return (
    <div className="space-y-8" dir="rtl">
      {/* כותרת ראשית */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-gray-900">ברוך הבא לניהול החנות, דניאל 👋</h1>
          <p className="text-xs text-gray-500 mt-1">הנה סיכום מצב החנות והעדכונים החשובים להיום.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <span>רענן נתונים</span> 🔄
        </button>
      </div>

      {/* קוביות נתונים עיקריות */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-orange-600">
          <span className="text-xs font-bold text-gray-500 block">הזמנות חדשות לטיפול</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{newOrders.length}</span>
            <span className="text-xs text-orange-600 font-bold">מתוך {orders.length} סה"כ</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-green-600">
          <span className="text-xs font-bold text-gray-500 block">הכנסות החודש (₪)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-600">₪{monthlyRevenue.toLocaleString()}</span>
            <span className="text-xs text-gray-400">החודש הנוכחי</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-red-500">
          <span className="text-xs font-bold text-gray-500 block">מוצרים במלאי נמוך (≤ 3)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-500">{lowStockProducts.length}</span>
            <span className="text-xs text-gray-400">דורש עדכון</span>
          </div>
        </div>
      </div>

      {/* הזמנות חדשות */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-base text-gray-900">🚨 הזמנות חדשות שממתינות לטיפול ({newOrders.length})</h3>
          </div>
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
                        onClick={() => handleStatusChange(ord.id, 'טופל')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        סמן כטופל ✓
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
