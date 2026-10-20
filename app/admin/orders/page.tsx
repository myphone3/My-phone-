'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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

  const handleStatusChange = async (orderId: string, newStatus: string, customerEmail?: string, customerName?: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('שגיאה בעדכון סטטוס: ' + error.message);
      return;
    }

    fetchOrders();
    setSelectedOrder((prev: any) => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);

    if (customerEmail) {
      let statusAction = `ההזמנה שלך התקבלה בהצלחה`;
      if (newStatus === 'מחכה למשלוח') statusAction = 'ההזמנה שלך מחכה למשלוח';
      else if (newStatus === 'מוכן לאיסוף') statusAction = 'ההזמנה שלך מוכנה לאיסוף';
      else if (newStatus === 'נשלח') statusAction = 'ההזמנה שלך נשלחה אליך';
      else if (newStatus === 'הושלם') statusAction = 'ההזמנה שלך הושלמה בהצלחה';
      else if (newStatus === 'בטיפול') statusAction = 'ההזמנה שלך נמצאת בטיפול';

      const orderShortId = orderId.slice(0, 8);
      const message = `שלום ${customerName || 'לקוח יקר'},\n\nNEW PHONE שמחים לעדכן אותך שההזמנה שלך (#${orderShortId}) ${statusAction}.\n\nשמחים לתת לך שירות!\nNEW PHONE`;

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customerEmail,
            subject: `עדכון סטטוס הזמנה #${orderShortId} - NEW PHONE`,
            message: message
          })
        });
      } catch (err) {
        console.error('Email send failed:', err);
      }
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('האם למחוק הזמנה זו לצמיתות?')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      alert('שגיאה במחיקת הזמנה: ' + error.message);
    } else {
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  // פתיחת חלון סיכום הזמנה עם סרגל כלים (הדפסה + חזור לאתר)
  const printOrderPdf = (order: any) => {
    const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

    const itemsRows = (order.items || []).map((item: any, idx: number) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;"><b>${item.name}</b> ${item.selectedVariant ? `(${item.selectedVariant})` : ''} ${item.selectedColor ? `- ${item.selectedColor.name}` : ''}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('נא לאפשר חלונות קופצים בדפדפן');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סיכום הזמנה #${order.id?.slice(0, 8)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 15px; direction: rtl; color: #111; background: #f8fafc; margin: 0; }
          
          /* סרגל כלים עליון */
          .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 12px 16px;
            border-radius: 14px;
            border: 1px solid #e2e8f0;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .btn-action {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 18px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            border: none;
            text-decoration: none;
            transition: background 0.2s;
          }
          .btn-print { background: #ea580c; color: white; }
          .btn-back { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

          /* דף ה-PDF/הסיכום */
          .invoice-paper {
            background: #ffffff;
            padding: 25px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            max-width: 700px;
            margin: 0 auto;
          }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 15px; margin-bottom: 20px; }
          .logo { width: 50px; height: 50px; border-radius: 50%; object-fit: contain; }
          .box { background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { background: #ea580c; color: white; padding: 10px; text-align: right; }
          .total { margin-top: 20px; text-align: left; font-size: 18px; font-weight: bold; color: #ea580c; border-top: 1px solid #e2e8f0; padding-top: 12px; }

          /* הסתרת סרגל הכלים בזמן הדפסה בפועל */
          @media print {
            .toolbar { display: none !important; }
            body { background: white; padding: 0; }
            .invoice-paper { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        
        <!-- סרגל כלים עליון -->
        <div class="toolbar">
          <button class="btn-action btn-back" onclick="window.close();">⬅️ חזור לאתר</button>
          <button class="btn-action btn-print" onclick="window.print();">🖨️ הדפס סיכום הזמנה</button>
        </div>

        <!-- דף הסיכום -->
        <div class="invoice-paper">
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${logoUrl}" class="logo" />
              <div>
                <div style="font-size: 20px; font-weight: 900;">NEW PHONE</div>
                <div style="font-size: 10px; color: #ea580c; font-weight: bold;">הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 14px; font-weight: bold;">הזמנה #${order.id?.slice(0, 8)}</div>
              <div style="font-size: 11px; color: #666;">${order.created_at ? new Date(order.created_at).toLocaleString('he-IL') : ''}</div>
            </div>
          </div>

          <div class="box">
            <strong>פרטי לקוח למשלוח:</strong><br>
            שם: ${order.customer_name || 'לא צוין'}<br>
            טלפון: ${order.phone || 'לא צוין'}<br>
            אימייל: ${order.email || 'לא צוין'}<br>
            כתובת: עיר: ${order.city || ''}, רחוב: ${order.street || ''} ${order.building || ''}<br>
            ${order.notes ? `<strong>הערות לקוח:</strong> ${order.notes}` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>תיאור פריט</th>
                <th style="text-align: center; width: 60px;">כמות</th>
                <th style="text-align: left; width: 80px;">סכום</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr style="background: #fff7ed;">
                <td style="padding: 10px;">${(order.items || []).length + 1}</td>
                <td style="padding: 10px;"><b>משלוח מהיר עד הבית</b></td>
                <td style="padding: 10px; text-align: center;">1</td>
                <td style="padding: 10px; text-align: left;">₪${order.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div class="total">
            סה"כ לתשלום: ₪${order.total_price || 0}
          </div>
        </div>

      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* כותרת */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת הזמנות */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-gray-50 border-b text-gray-700 font-bold">
              <tr>
                <th className="p-4">מזהה הזמנה</th>
                <th className="p-4">שם הלקוח</th>
                <th className="p-4">טלפון</th>
                <th className="p-4">תאריך</th>
                <th className="p-4">סטטוס</th>
                <th className="p-4">סה"כ</th>
                <th className="p-4 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-800">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-50/40 transition cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="p-4 font-black text-orange-800">#{order.id ? order.id.slice(0, 8) : ''}</td>
                    <td className="p-4 font-bold text-gray-900">{order.customer_name || 'ללא שם'}</td>
                    <td className="p-4 dir-ltr text-right">{order.phone || 'לא צוין'}</td>
                    <td className="p-4 text-gray-500">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : 'לא ידוע'}
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.status || 'חדש'}
                        onChange={(e) => handleStatusChange(order.id, e.target.value, order.email, order.customer_name)}
                        className="bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
                      >
                        <option value="חדש">חדש 🆕</option>
                        <option value="בטיפול">בטיפול ⏳</option>
                        <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                        <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                        <option value="נשלח">נשלח 🚚</option>
                        <option value="הושלם">הושלם ✓</option>
                      </select>
                    </td>
                    <td className="p-4 font-black text-orange-600">₪{order.total_price || 0}</td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        👁️ צפה בפרטים
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-gray-400">
                    אין הזמנות חדשות במערכת כרגע.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודל פרטי הזמנה */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border relative">
            
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md">
                  סיכום הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                </span>
                <h2 className="text-lg font-black text-gray-900 mt-1">
                  NEW PHONE - הפלאפון החדש שלך
                </h2>
                <div className="text-xs text-gray-500 mt-0.5">
                  תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/60 p-4 rounded-2xl border border-orange-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">סטטוס:</span>
                <select
                  value={selectedOrder.status || 'חדש'}
                  onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.email, selectedOrder.customer_name)}
                  className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer shadow-xs"
                >
                  <option value="חדש">חדש 🆕</option>
                  <option value="בטיפול">בטיפול ⏳</option>
                  <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                  <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                  <option value="נשלח">נשלח 🚚</option>
                  <option value="הושלם">הושלם ✓</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => printOrderPdf(selectedOrder)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  🖨️ הדפס סיכום הזמנה
                </button>
                <button
                  onClick={() => deleteOrder(selectedOrder.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-red-200"
                >
                  🗑️ מחק
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border">
              <div>
                <span className="font-bold block mb-1 text-gray-900">פרטי התקשרות וכתובת:</span>
                <p>📞 טלפון: <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold">{selectedOrder.phone}</a></p>
                <p className="mt-1">✉️ אימייל: {selectedOrder.email || 'לא צוין'}</p>
                <p className="mt-1">📍 עיר: {selectedOrder.city || 'לא צוין'} | רחוב: {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
                {selectedOrder.notes && (
                  <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <strong>הערות לקוח:</strong> {selectedOrder.notes}
                  </p>
                )}
              </div>
              <div className="flex flex-col justify-between text-left sm:text-left">
                <div>
                  <span className="font-bold block mb-1 text-gray-900">סיכום תשלום:</span>
                  <p className="text-xs text-gray-600">עלות משלוח: ₪{selectedOrder.shipping_cost || 29}</p>
                </div>
                <div>
                  <span className="text-sm font-black text-orange-600 block mt-2">סה"כ לתשלום: ₪{selectedOrder.total_price || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => (
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
                <div className="flex items-center justify-between bg-orange-50/50 border border-orange-200 p-3 rounded-xl text-xs">
                  <span className="font-bold text-gray-900">משלוח מהיר עד הבית</span>
                  <span className="text-orange-600 font-black">₪{selectedOrder.shipping_cost || 29}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t text-center">
              <button
                onClick={() => setSelectedOrder(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                סגור חלון
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
