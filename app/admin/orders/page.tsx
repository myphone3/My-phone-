'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setOrders(data);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('שגיאה בעדכון הסטטוס: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  const printOrder = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = order.items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.version || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.color || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.storage || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.quantity || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">₪${item.price}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html dir="rtl" lang="he">
        <head>
          <title>סיכום הזמנה #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            h1 { font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .details { margin-bottom: 20px; font-size: 14px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
            th { background: #f4f4f4; padding: 8px; text-align: right; border-bottom: 2px solid #ddd; }
            .total { margin-top: 20px; font-size: 16px; font-weight: bold; text-align: left; }
          </style>
        </head>
        <body>
          <h1>📦 סיכום הזמנה מחנות הסלולר</h1>
          <div class="details">
            <p><strong>מספר הזמנה:</strong> ${order.id}</p>
            <p><strong>תאריך:</strong> ${new Date(order.created_at).toLocaleString('he-IL')}</p>
            <p><strong>שם הלקוח:</strong> ${order.customer_name}</p>
            <p><strong>טלפון:</strong> ${order.phone}</p>
            <p><strong>סוג קבלה:</strong> ${order.shipping_type}</p>
            <p><strong>כתובת / פרטים:</strong> ${order.address || 'לא צוינה כתובת'}</p>
            <p><strong>סטטוס הזמנה:</strong> ${order.status}</p>
          </div>
          <h3>פירוט המוצרים:</h3>
          <table>
            <thead>
              <tr>
                <th>שם המוצר</th>
                <th>גרסה</th>
                <th>צבע</th>
                <th>נפח אחסון</th>
                <th>כמות</th>
                <th>מחיר</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="total">סה"כ לתשלום: ₪${order.total_amount}</div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-12" dir="rtl">
      <header className="bg-white border-b shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-black text-gray-900 tracking-tight">🛠️ פאנל ניהול חנות</h1>
            <nav className="hidden md:flex items-center gap-2">
              <Link href="/admin/products" className="text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold transition">
                מוצרים 📱
              </Link>
              <Link href="/admin/orders" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">
                הזמנות 📦
              </Link>
            </nav>
          </div>
          <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold transition">
            חזרה לחנות 🏠
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <h2 className="text-xl font-black text-gray-900">ניהול הזמנות הלקוחות ({orders.length})</h2>

        {loading ? (
          <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border p-8 space-y-2 shadow-sm">
            <span className="text-4xl">📭</span>
            <p className="text-gray-500 font-medium">אין הזמנות חדשות במערכת כרגע.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-2">
                  <div>
                    <span className="text-xs font-bold bg-gray-100 px-3 py-1 rounded-full text-gray-700">
                      הזמנה #{order.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-gray-400 mr-3">
                      {new Date(order.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printOrder(order)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      🖨️ הדפס סיכום הזמנה
                    </button>
                    
                    <select
                      value={order.status || 'בטיפול'}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer ${
                        order.status === 'הושלם' ? 'bg-green-50 text-green-700 border-green-200' :
                        order.status === 'נשלח' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        order.status === 'מוכן לאיסוף' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      <option value="בטיפול">בטיפול 🔄</option>
                      <option value="מוכן לאיסוף">מוכן לאיסוף 📦</option>
                      <option value="נשלח">נשלח 🚚</option>
                      <option value="הושלם">הושלם ✅</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-gray-50 p-4 rounded-2xl">
                  <div>
                    <span className="text-gray-400 block mb-0.5">שם הלקוח:</span>
                    <span className="font-bold text-gray-900 text-sm">{order.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">טלפון:</span>
                    <span className="font-bold text-gray-900 text-sm" dir="ltr">{order.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">סוג קבלה וכתובת:</span>
                    <span className="font-bold text-gray-900 text-sm">
                      {order.shipping_type} {order.address ? `(${order.address})` : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black text-gray-500">מוצרים בהזמנה:</h4>
                  <div className="divide-y border rounded-2xl overflow-hidden">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 flex justify-between items-center text-xs bg-white">
                        <div className="space-y-1">
                          <span className="font-bold text-gray-900 text-sm block">{item.name}</span>
                          <div className="flex gap-3 text-gray-500 text-xs">
                            {item.version && <span>גרסה: <strong>{item.version}</strong></span>}
                            {item.color && <span>צבע: <strong>{item.color}</strong></span>}
                            {item.storage && <span>נפח: <strong>{item.storage}</strong></span>}
                          </div>
                        </div>
                        <div className="text-left font-bold">
                          <span>כמות: {item.quantity || 1}</span>
                          <span className="block text-gray-900 mt-0.5">₪{item.price * (item.quantity || 1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-xs font-bold text-gray-500">סה"כ לתשלום:</span>
                  <span className="text-base font-black text-gray-900">₪{order.total_amount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
