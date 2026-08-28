'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const statusOptions = ['בטיפול', 'נשלח', 'מוכן לאיסוף', 'הושלם'];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      alert('שגיאה בעדכון הסטטוס: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-gray-900">ניהול הזמנות 🛒</h1>
          <p className="text-gray-500 text-sm mt-1">צפה בכל ההזמנות הנכנסות ונהל את סטטוס הטיפול בהן.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-black text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-md print:hidden"
        >
          🖨️ הדפס סיכום הזמנות
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">טוען הזמנות...</p>
      ) : orders.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border text-center text-gray-400">אין עדיין הזמנות במערכת.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-2">
                <div>
                  <span className="text-xs bg-gray-100 px-3 py-1 rounded-lg font-mono text-gray-600">מזהה: {order.id.slice(0, 8)}...</span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">לקוח: {order.name || order.customer_name || 'לא צוין'}</h3>
                  <p className="text-sm text-gray-500">טלפון: {order.phone || order.customer_phone || 'לא צוין'} | כתובת: {order.address || order.customer_address || 'איסוף עצמי'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-700">סטטוס:</span>
                  <select 
                    value={order.status || 'בטיפול'} 
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="border rounded-xl p-2.5 text-sm font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-black"
                  >
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* פריטי ההזמנה */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase">מוצרים בהזמנה:</h4>
                <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                  {order.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-800">{item.name} {item.selectedColor ? `(צבע: ${item.selectedColor})` : ''} {item.selectedVersion ? `(גרסה: ${item.selectedVersion})` : ''} x {item.quantity || 1}</span>
                      <span className="font-bold text-gray-900">₪{(item.price || 0) * (item.quantity || 1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('he-IL')}</span>
                <div className="text-lg font-black text-black">סה״כ לתשלום: ₪{order.total}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
