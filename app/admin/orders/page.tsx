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
      else if (newStatus === 'מבוטל') statusAction = 'ההזמנה שלך בוטלה';

      const orderShortId = orderId.slice(0, 8);
      const message = `שלום ${customerName || 'לקוח יקר'},\n\nשמחים לעדכן אותך שההזמנה שלך (#${orderShortId}) ${statusAction}.\n\nשמחים לתת לך שירות!`;

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customerEmail,
            subject: `עדכון סטטוס הזמנה #${orderShortId}`,
            message: message
          })
        });
      } catch (err) {
        console.error('Email send failed:', err);
      }
    }
  };

  const getColorName = (colorVal: any) => {
    if (!colorVal) return '';
    if (typeof colorVal === 'string') return colorVal;
    if (typeof colorVal === 'object' && colorVal.name) return String(colorVal.name);
    return '';
  };

  // פתיחת עמוד סיכום הזמנה נקי בטאב חדש עם הפעלה אוטומטית של דיאלוג ההדפסה/PDF
  const handlePrint = () => {
    if (!selectedOrder) return;

    const logoUrl = 'https://iiaxizrezhczgutqijbe.supabase.co/storage/v1/object/public/product-images/IMG_6252.jpeg';

    const itemsRows = (selectedOrder.items || []).map((item: any, idx: number) => {
      const colorText = getColorName(item.selectedColor);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; text-align: center; font-weight: bold; width: 30px;">${idx + 1}</td>
          <td style="padding: 10px; font-weight: bold;">
            ${item.name || 'מוצר'}
            ${item.selectedVariant ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">גרסה: ${item.selectedVariant}</div>` : ''}
            ${colorText ? `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">צבע: ${colorText}</div>` : ''}
          </td>
          <td style="padding: 10px; text-align: center; font-weight: bold; width: 50px;">${item.quantity || 1}</td>
          <td style="padding: 10px; text-align: left; font-weight: bold; width: 80px;">₪${(item.sale_price || item.price || 0) * (item.quantity || 1)}</td>
        </tr>
      `;
    }).join('');

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('אנא אפשר חלונות קופצים (Popups) בדפדפן כדי להציג את סיכום ההזמנה.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>סיכום הזמנה #${selectedOrder.id?.slice(0, 8)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111827; direction: rtl; margin: 0; background: #fff; }
          .container { max-width: 650px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ea580c; padding-bottom: 16px; margin-bottom: 20px; }
          .logo-box { display: flex; align-items: center; gap: 12px; }
          .logo-img { width: 55px; height: 55px; object-fit: contain; border-radius: 50%; }
          .store-title { font-size: 22px; font-weight: 900; color: #111827; }
          .store-sub { font-size: 11px; color: #ea580c; font-weight: bold; }
          .details-card { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          th { background-color: #ea580c; color: #ffffff; padding: 10px; text-align: right; }
          .total-card { margin-top: 20px; text-align: left; font-size: 18px; font-weight: 900; color: #ea580c; border-top: 2px solid #e5e7eb; padding-top: 14px; }
          .footer-note { margin-top: 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #e5e7eb; padding-top: 12px; }
          
          .action-bar { max-width: 650px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; }
          .btn-print-now { background: #ea580c; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
          .btn-close-now { background: #e5e7eb; color: #374151; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }

          @media print {
            .action-bar { display: none !important; }
            body { padding: 0; }
            .container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="action-bar">
          <button class="btn-close-now" onclick="window.close()">✕ סגור</button>
          <button class="btn-print-now" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button>
        </div>

        <div class="container">
          <div class="header">
            <div class="logo-box">
              <img src="${logoUrl}" alt="NEW PHONE" class="logo-img" />
              <div>
                <div class="store-title">NEW PHONE</div>
                <div class="store-sub">הפלאפון החדש שלך</div>
              </div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 15px; font-weight: 900; color: #ea580c;">סיכום הזמנה</div>
              <div style="font-size: 12px; font-weight: bold; color: #374151;">#${selectedOrder.id?.slice(0, 8)}</div>
              <div style="font-size: 10px; color: #6b7280;">${selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : ''}</div>
            </div>
          </div>

          <div class="details-card">
            <strong>פרטי לקוח למשלוח:</strong><br>
            שם מלא: <strong>${selectedOrder.customer_name || 'לא צוין'}</strong><br>
            טלפון: ${selectedOrder.phone || 'לא צוין'}<br>
            אימייל: ${selectedOrder.email || 'לא צוין'}<br>
            כתובת למשלוח: עיר: ${selectedOrder.city || ''}, רחוב: ${selectedOrder.street || ''} ${selectedOrder.building || ''}<br>
            ${selectedOrder.notes ? `<div style="margin-top:6px; color:#c2410c;"><strong>הערות למשלוח:</strong> ${selectedOrder.notes}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>תיאור מוצר / פריט</th>
                <th style="width: 50px; text-align: center;">כמות</th>
                <th style="width: 80px; text-align: left;">מחיר</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr style="border-bottom: 1px solid #e5e7eb; background-color: #fff7ed;">
                <td style="padding: 10px; text-align: center; font-weight: bold;">${(selectedOrder.items || []).length + 1}</td>
                <td style="padding: 10px; font-weight: bold;">משלוח מהיר עד הבית</td>
                <td style="padding: 10px; text-align: center; font-weight: bold;">1</td>
                <td style="padding: 10px; text-align: left; font-weight: bold;">₪${selectedOrder.shipping_cost || 29}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-card">
            סה"כ לתשלום: ₪${selectedOrder.total_price || 0}
          </div>

          <div class="footer-note">
            תודה שקנית ב-NEW PHONE! נשמח לראותך שוב ❤️
          </div>
        </div>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium">טוען הזמנות...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2 sm:p-4" dir="rtl">
      
      {/* כותרת העמוד */}
      <div className="flex items-center justify-between my-2">
        <h1 className="text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 flex items-center gap-2">
          <span>📋</span>
          <span>ניהול הזמנות</span>
          <span className="text-sm font-normal text-gray-500">({orders.length})</span>
        </h1>
      </div>

      {/* טבלת ההזמנות */}
      <div className="bg-white rounded-3xl border shadow-xs overflow-hidden">
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
                        <option value="מבוטל">מבוטל ❌</option>
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

      {/* מודל פרטי ההזמנה במערכת הניהול */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl border relative my-auto">
            
            {/* סרגל עליון */}
            <div className="flex items-center justify-between border-b pb-3 sticky top-0 bg-white z-10">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600 cursor-pointer text-sm"
              >
                ✕
              </button>

              <button
                onClick={handlePrint}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🖨️</span>
                <span>הדפס / שמור כ-PDF</span>
              </button>
            </div>

            {/* פרטי מזהה הזמנה וסטטוס */}
            <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-200 flex items-center justify-between">
              <div>
                <span className="bg-orange-100 text-orange-800 text-[11px] font-black px-2 py-0.5 rounded-md">
                  הזמנה #{selectedOrder.id ? selectedOrder.id.slice(0, 8) : ''}
                </span>
                <div className="text-[11px] text-gray-500 mt-1">
                  תאריך: {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('he-IL') : 'לא ידוע'}
                </div>
              </div>

              <select
                value={selectedOrder.status || 'חדש'}
                onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.email, selectedOrder.customer_name)}
                className="bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer shadow-xs"
              >
                <option value="חדש">חדש 🆕</option>
                <option value="בטיפול">בטיפול ⏳</option>
                <option value="מחכה למשלוח">מחכה למשלוח 📦</option>
                <option value="מוכן לאיסוף">מוכן לאיסוף 🛍️</option>
                <option value="נשלח">נשלח 🚚</option>
                <option value="הושלם">הושלם ✓</option>
                <option value="מבוטל">מבוטל ❌</option>
              </select>
            </div>

            {/* פרטי הלקוח והכתובת */}
            <div className="text-xs text-gray-700 bg-gray-50 p-4 rounded-2xl border space-y-1.5">
              <span className="font-bold block text-gray-900 mb-1">פרטי לקוח למשלוח:</span>
              <p>👤 <strong>שם:</strong> {selectedOrder.customer_name || 'לא צוין'}</p>
              <p>📞 <strong>טלפון:</strong> <a href={`tel:${selectedOrder.phone}`} className="text-blue-600 font-bold">{selectedOrder.phone || 'לא צוין'}</a></p>
              <p>✉️ <strong>אימייל:</strong> {selectedOrder.email || 'לא צוין'}</p>
              <p>📍 <strong>כתובת:</strong> {selectedOrder.city || ''}, {selectedOrder.street || ''} {selectedOrder.building || ''}</p>
              {selectedOrder.notes && (
                <p className="mt-2 text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                  <strong>הערות לקוח:</strong> {selectedOrder.notes}
                </p>
              )}
            </div>

            {/* סיכום תשלום */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-900 block">סיכום תשלום:</span>
                <span className="text-gray-500">עלות משלוח: ₪{selectedOrder.shipping_cost || 29}</span>
              </div>
              <span className="text-base font-black text-orange-600">₪{selectedOrder.total_price || 0}</span>
            </div>

            {/* מוצרים בהזמנה */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">מוצרים בהזמנה:</span>
              <div className="space-y-2 max-h-48 overflow-y-auto pl-1">
                {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, idx: number) => {
                  const colorText = getColorName(item.selectedColor);
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50/50 border p-3 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        {item.image_url && <img src={item.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border p-0.5" />}
                        <div>
                          <span className="font-bold text-gray-900 block">{item.name}</span>
                          {item.selectedVariant && <span className="text-[10px] text-gray-500">גרסה: {item.selectedVariant} | </span>}
                          {colorText && <span className="text-[10px] text-gray-500">צבע: {colorText}</span>}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-gray-900">כמות: {item.quantity || 1}</span>
                        <span className="text-orange-600 font-black block">₪{(item.sale_price || item.price || 0) * (item.quantity || 1)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between bg-orange-50/50 border border-orange-200 p-3 rounded-xl text-xs">
                  <span className="font-bold text-gray-900">משלוח מהיר עד הבית</span>
                  <span className="text-orange-600 font-black">₪{selectedOrder.shipping_cost || 29}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
