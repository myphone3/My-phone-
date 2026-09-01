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
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) alert('שגיאה בעדכון סטטוס: ' + error.message);
    else fetchOrders();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
        <h2 className="text-base font-black text-gray-900 border-r-4 border-orange-600 pr-3">הזמנות לקוחות ({orders.length})</h2>
        
        {orders.length === 0 ? (
          <p className="text-xs text-gray-500 py-10 text-center">אין הזמנות חדשות במערכת כרגע.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border rounded-2xl p-5 bg-gray-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
                  <div>
                    <h3 className="font-black text-sm text-gray-900">לקוח: {order.customer_name}</h3>
                    <p className="text-xs text-gray-600">📞 טלפון: <span className="font-bold">{order.phone}</span> | 📍 כתובת: <span className="font-bold">{order.address}</span></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('he-IL')}</span>
                    <select
                      value={order.status || 'חדש'}
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                      className="bg-white border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-orange-600"
                    >
                      <option value="חדש">חדש 🟡</option>
                      <option value="בטיפול">בטיפול 🔵</option>
                      <option value="הושלם">הושלם 🟢</option>
                      <option value="בוטל">בוטל 🔴</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border rounded-xl p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 object-contain rounded border" />}
                          <div>
                            <span className="font-bold block truncate max-w-[150px]">{item.name}</span>
                            <span className="text-[10px] text-gray-500">
                              {item.selectedVariant && `גרסה: ${item.selectedVariant} `}
                              {item.selectedColor && `צבע: ${item.selectedColor.name}`}
                              {` | כמות: ${item.quantity || 1}`}
                            </span>
                          </div>
                        </div>
                        <span className="font-black text-orange-600">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t text-sm font-black">
                  <span>סה״כ לתשלום בהזמנה:</span>
                  <span className="text-orange-600 text-base">₪{order.total_price}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
