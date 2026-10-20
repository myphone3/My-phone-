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

  // יצירת תעודת משלוח נקייה ומעוצבת המיועדת להדפסה פיזית לחבילה
  const printPackingSlip = (order: any) => {
    const logoUrl = '/Logo.JPG';

    const itemsRows = (order.items || []).map((item: any, idx: number) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 12px; font-weight: bold;">
          ${item.name}
          ${item.selectedVariant ? `<div style="font-size: 11px; color: #6b7280;">גרסה: ${item.selectedVariant}</div>` : ''}
          ${item.selectedColor ? `<div style="font-size: 11px; color: #6b7280;">צבע: ${item.selectedColor.name}</div>` : ''}
        </td>
        <td style="padding: 12px; text-align: center; font-weight: bold; font-size: 14px;">${item.quantity || 1}</td>
        <td style="padding: 12px; text-align: left; font-weight: bold;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>תעודת משלוח - הזמנה #${order.id?.slice(0, 8)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111827; direction: rtl; margin: 0; background: #f3f4f6; }
          
          .no-print-header {
            background: #111827;
            color: white;
            padding: 16px;
            border-radius: 16px;
            text-align: center;
            max-width: 650px;
            margin: 0 auto 20px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          
          .btn-print {
            background: #ea580c;
            color: white;
            border: none;
            padding: 12px 28px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            margin-top: 8px;
            box-shadow: 0 2px 6px rgba(234,88,12,0.4);
          }

          .slip-card {
            background: white;
            padding: 30px;
            border-radius: 20px;
            max-width: 650px;
            margin: 0 auto;
            border: 1px solid #e5e7eb;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }

          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 15px; margin-bottom: 20px; }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-img { width: 55px; height: 55px; object-fit: contain; border-radius: 50%; border: 1px solid #eee; }
          .store-name { font-size: 22px; font-weight: 900; color: #111; }
          .store-sub { font-size: 11px; color: #ea580c; font-weight: bold; }

          .section-title { font-size: 13px; font-weight: 800; color: #374151; margin-bottom: 6px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f9fafb; padding: 16px; border-radius: 14px; border: 1px solid #e5e7eb; margin-bottom: 20px; font-size: 13px; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #f3f4f6; color: #374151; padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb; }

          .total-box { margin-top: 20px; padding-top: 15px; border-t: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
          .total-price { font-size: 20px; font-weight: 900; color: #ea580c; }

          .footer-msg { margin-top: 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #d1d5db; padding-top: 15px; font-weight: 600; }

          @media print {
            .no-print-header { display: none !important; }
            body { background: white; padding: 0; }
            .slip-card { border: none; box-shadow: none; padding: 10px; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        
        <div class="no-print-header">
          <div style="font-weight: bold; font-size: 15px;">תעודת משלוח מוכנה להדפסה לחבילה</div>
          <button class="btn-print" onclick="window.print()">🖨️ לחץ כאן להדפסה</button>
        </div>

        <div class="slip-card">
          <div class="header">
            <div class="logo-box">
              <img src="${logoUrl}" alt="NEW PHONE" class="logo-img" onError="this.style.display='none'" />
              <div>
                <div class="store-name">NEW PHONE</div>
                <div class="store-sub">הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 14px; font-weight: 900; color: #ea580c;">תעודת משלוח</div>
              <div style="font-size: 12px; font-weight: bold;">הזמנה #${order.id?.slice(0, 8)}</div>
              <div style="font-size: 10px; color: #6b7280;">${order.created_at ? new Date(order.created_at).toLocaleDateString('he-IL') : ''}</div>
            </div>
          </div>

          <div class="section-title">📍 פרטי משלוח ולקוח:</div>
          <div class="info-grid">
            <div>
              <strong>שם הלקוח:</strong> ${order.customer_name || 'ללא שם'}<br>
              <strong>טלפון:</strong> ${order.phone || 'לא צוין'}<br>
              <strong>אימייל:</strong> ${order.email || 'לא צוין'}
            </div>
            <div>
              <strong>עיר:</strong> ${order.city || 'לא צוין'}<br>
              <strong>כתובת:</strong> ${order.street || ''} ${order.building || ''}<br>
              <strong>שיטת שירות:</strong> משלוח מהיר עד הבית
            </div>
          </div>

          ${order.notes ? `
            <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 14px; border-radius: 10px; font-size: 12px; margin-bottom: 20px; color: #c2410c;">
              <strong>הערות לטיפול:</strong> ${order.notes}
            </div>
          ` : ''}

          <div class="section-title">📦 מוצרים בחבילה:</div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>תיאור פריט</th>
                <th style="width: 70px; text-align: center;">כמות</th>
                <th style="width: 90px; text-align: left;">סה"כ</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr style="border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
                <td style="padding: 12px; text-align: center; font-weight: bold;">${(order.items || []).length + 1}</td>
                <td style="padding: 12px; font-weight: bold;">משלוח מהיר עד הבית</td>
                <td style="padding: 12px; text-align: center; font-weight: bold;">1</td>
                <td style="padding: 12px; text-align: left; font-weight: bold;">₪${order.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-box">
            <span style="font-size: 14px; font-weight: bold; color: #374151;">סה"כ כולל משלוח:</span>
            <span class="total-price">₪${order.total_price || 0}</span>
          </div>

          <div class="footer-msg">
            תודה שקנית ב-NEW PHONE! נשמח לעמוד לשירותך בכל עת. ❤️
          </div>
        </div>

      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(htmlContent);
      printWin.document.close();
    } else {
      alert('נא לאפשר פתיחת חלונות קופצים בדפדפן לצורך הדפסה');
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* כותרת נקייה */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת רשימת הזמנות מקוצרת */}
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

      {/* חלון מודל (Modal) מלא להצגת פרטי ההזמנה הנבחרת */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border relative">
            
            {/* כותרת מודל */}
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <span className="bg-orange-100 text-orange-800 text-xs font-black px-2.5 py-1 rounded-md">
                  הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                </span>
                <h2 className="text-lg font-black text-gray-900 mt-1">
                  לקוח: {selectedOrder.customer_name || 'ללא שם'}
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

            {/* פעולות מהירות בתוך המודל */}
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
                  onClick={() => printPackingSlip(selectedOrder)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  🖨️ הדפס תעודת משלוח
                </button>
                <button
                  onClick={() => deleteOrder(selectedOrder.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-red-200"
                >
                  🗑️ מחק
                </button>
              </div>
            </div>

            {/* פרטי התקשרות וכתובת */}
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

            {/* רשימת המוצרים בהזמנה */}
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

            {/* כפתור סגירה תחתון */}
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
