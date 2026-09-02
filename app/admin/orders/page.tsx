'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('שגיאה בשליפת הזמנות:', error.message);
    } else if (data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('שגיאה בעדכון סטטוס: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('האם למחוק הזמנה זו לצמיתות?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('שגיאה במחיקת הזמנה: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm">
        <h1 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">
          ניהול הזמנות לקוחות ({orders.length})
        </h1>
        <button
          onClick={fetchOrders}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          🔄 רענן רשימה
        </button>
      </div>

      <div className="space-y-4">
        {orders.length > 0 ? (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                <div>
                  <span className="text-xs font-black text-gray-900 block">
                    הזמנה מאת: {order.customer_name || 'ללא שם'}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    תאריך: {order.created_at ? new Date(order.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={order.status || 'חדש'}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="חדש">חדש 🆕</option>
                    <option value="בטיפול">בטיפול ⏳</option>
                    <option value="נשלח">נשלח 🚚</option>
                    <option value="הושלם">הושלם ✓</option>
                  </select>
                  <button
                    onClick={() => deleteOrder(order.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1.5 cursor-pointer"
                    title="מחק הזמנה"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border">
                <div>
                  <span className="font-bold block mb-1 text-gray-900">פרטי התקשרות:</span>
                  <p>📞 טלפון: <a href={`tel:${order.phone}`} className="text-blue-600 font-bold">{order.phone}</a></p>
                  <p className="mt-1">📍 כתובת: {order.address}</p>
                </div>
                <div className="text-left sm:text-left">
                  <span className="font-bold block mb-1 text-gray-900">סיכום תשלום:</span>
                  <p className="text-sm font-black text-orange-600">₪{order.total_price || 0}</p>
                </div>
              </div>

              {/* רשימת המוצרים בהזמנה */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
                <div className="space-y-2">
                  {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50/50 border p-3 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border p-0.5" />}
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name}</span>
                          {item.selectedVariant && <span className="text-[10px] text-gray-500">גרסה: {item.selectedVariant} | </span>}
                          {item.selectedColor && <span className="text-[10px] text-gray-500">צבע: {item.selectedColor.name}</span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-gray-900">כמות: {item.quantity || 1}</span>
                        <span className="text-orange-600 font-black block">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-3 shadow-sm">
            <span className="text-4xl">📦</span>
            <h3 className="font-black text-sm text-gray-900">אין הזמנות חדשות במערכת כרגע</h3>
            <p className="text-xs text-gray-400">ברגע שקוח יבצע הזמנה בחנות, היא תופיע כאן מיד.</p>
          </div>
        )}
      </div>
    </div>
  );
}
