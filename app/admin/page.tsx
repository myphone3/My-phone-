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
    setLoading(true);
    const { data: ordersData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const { data: productsData } = await supabase.from('products').select('*');
    
    if (ordersData) setOrders(ordersData);
    if (productsData) setProducts(productsData);
    setLoading(false);
  };

  // חישוב הכנסות החודש הנוכחי
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = orders
    .filter(o => {
      const orderDate = new Date(o.created_at || o.date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    })
    .reduce((sum, o) => sum + (Number(o.total_price || o.price || o.amount) || 0), 0);

  // מוצרים עם מלאי נמוך (פחות מ-3 יחידות)
  const lowStockProducts = products.filter(p => (Number(p.stock) || 0) <= 3);

  // הזמנות חדשות
  const newOrders = orders.filter(o => o.status === 'חדש' || !o.status || o.status === 'pending');

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען נתוני דף הבית...</div>;

  return (
    <div className="space-y-8" dir="rtl">
      {/* כותרת וברכה */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">ברוך הבא לניהול החנות, דניאל 👋</h1>
          <p className="text-xs text-gray-500 mt-1">הנה סיכום מצב החנות והעדכונים החשובים להיום.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm">
            📦 ניהול הזמנות ({orders.length})
          </Link>
          <Link href="/admin/products" className="bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm">
            📱 ניהול מוצרים ({products.length})
          </Link>
        </div>
      </div>

      {/* קוביות נתונים עיקריות (Widgets) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-2 border-r-4 border-r-orange-600">
          <span className="text-xs font-bold text-gray-500 block">הזמנות חדשות שממתינות לטיפול</span>
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

      {/* התראות ודגשים לטיפול */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* הזמנות אחרונות */}
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-black text-sm text-gray-900">הזמנות אחרונות בחנות</h3>
            <Link href="/admin/orders" className="text-xs font-bold text-orange-600 hover:underline">לכל ההזמנות ➔</Link>
          </div>
          <div className="space-y-3">
            {orders.slice(0, 5).length > 0 ? (
              orders.slice(0, 5).map((ord, idx) => (
                <div key={ord.id || idx} className="bg-gray-50 p-3.5 rounded-2xl border flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">הזמנה #{ord.id?.slice(0, 8) || idx + 1} - {ord.customer_name || ord.name || 'לקוח'}</span>
                    <span className="text-[11px] text-gray-500">{ord.created_at ? new Date(ord.created_at).toLocaleDateString('he-IL') : 'היום'}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black text-orange-600 block">₪{ord.total_price || ord.price || 0}</span>
                    <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">{ord.status || 'חדש'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">אין עדיין הזמנות במערכת.</p>
            )}
          </div>
        </div>

        {/* מוצרים במלאי נמוך */}
        <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-black text-sm text-gray-900">⚠️ מוצרים במלאי נמוך (דורש השלמה)</h3>
            <Link href="/admin/products" className="text-xs font-bold text-orange-600 hover:underline">לניהול מוצרים ➔</Link>
          </div>
          <div className="space-y-3">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.slice(0, 5).map((p) => (
                <div key={p.id} className="bg-red-50/50 border border-red-100 p-3.5 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img src={p.image_url} alt="" className="w-8 h-8 object-contain bg-white rounded-lg border p-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">{p.name}</h4>
                      <span className="text-[11px] text-red-600 font-bold">נותרו רק {p.stock ?? 0} יחידות במלאי!</span>
                    </div>
                  </div>
                  <Link href="/admin/products" className="bg-white border text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-gray-50">
                    עדכן מלאי
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">מעולה! אין מוצרים במלאי נמוך כרגע.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
